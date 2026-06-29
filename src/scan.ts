/**
 * Scan `~/.claude/projects/**\/*.jsonl`, slice each file at its cursor, parse the
 * new lines, and assemble per-file upload batches. Git metadata is resolved best
 * effort and never fatal.
 */

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { FileCursor, StateFile } from "./state.ts";

export type ScannedFile = {
	/** Absolute path of the .jsonl on disk (the cursor key). */
	filePath: string;
	/** sessionId = filename without `.jsonl`. */
	providerSessionId: string;
	projectPathAbs: string;
	gitRemoteRaw?: string;
	gitBranch?: string;
	/** sha256 of the exact new bytes being sent for this file. */
	sha256: string;
	/** Parsed new records (malformed lines skipped). */
	records: unknown[];
	/** Byte offset to persist once the upload of `records` succeeds. */
	newBytesUploaded: number;
	/** Line count to persist once the upload succeeds. */
	newLinesUploaded: number;
	/** Lines that failed to JSON.parse (reported, not uploaded). */
	skippedLines: number;
};

const cwdCache = new Map<string, { remote?: string; branch?: string }>();

function decodeProjectDir(encoded: string): string {
	// `-home-adys-src-foo` → `/home/adys/src/foo`. The encoded form replaces `/`
	// with `-` and leads with `-`. This is a lossy fallback: a record's own `cwd`
	// is preferred when present (dashes in real path segments are ambiguous here).
	if (encoded.startsWith("-")) {
		return `/${encoded.slice(1).replace(/-/g, "/")}`;
	}
	return encoded.replace(/-/g, "/");
}

function gitInfo(projectPathAbs: string): { remote?: string; branch?: string } {
	const cached = cwdCache.get(projectPathAbs);
	if (cached) {
		return cached;
	}

	const run = (args: string[]): string | undefined => {
		try {
			const out = execFileSync("git", ["-C", projectPathAbs, ...args], {
				stdio: ["ignore", "pipe", "ignore"],
				encoding: "utf8",
				timeout: 5000,
			});
			const trimmed = out.trim();
			return trimmed.length > 0 ? trimmed : undefined;
		} catch {
			return undefined;
		}
	};

	const info = {
		remote: run(["config", "--get", "remote.origin.url"]),
		branch: run(["rev-parse", "--abbrev-ref", "HEAD"]),
	};
	cwdCache.set(projectPathAbs, info);
	return info;
}

/** Walk the projects dir for *.jsonl files. */
function listTranscripts(projectsDir: string): string[] {
	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(projectsDir, { withFileTypes: true });
	} catch {
		return [];
	}

	const out: string[] = [];
	for (const entry of entries) {
		const full = path.join(projectsDir, entry.name);
		if (entry.isDirectory()) {
			out.push(...listTranscripts(full));
		} else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
			out.push(full);
		}
	}
	return out;
}

function pickProjectPath(records: unknown[], encodedDir: string): string {
	for (const rec of records) {
		if (typeof rec === "object" && rec !== null) {
			const cwd = (rec as Record<string, unknown>).cwd;
			if (typeof cwd === "string" && cwd.length > 0) {
				return cwd;
			}
		}
	}
	return decodeProjectDir(encodedDir);
}

function pickBranch(records: unknown[]): string | undefined {
	// Last record's branch is the most current.
	for (let i = records.length - 1; i >= 0; i--) {
		const rec = records[i];
		if (typeof rec === "object" && rec !== null) {
			const b = (rec as Record<string, unknown>).gitBranch;
			if (typeof b === "string" && b.length > 0) {
				return b;
			}
		}
	}
	return undefined;
}

export type ScanOptions = {
	projectsDir: string;
	state: StateFile;
	projectFilter: string | null;
};

/**
 * Produce one ScannedFile per transcript that has NEW content past its cursor.
 * Files with no new lines (or only malformed new lines) are omitted.
 */
export function scan(opts: ScanOptions): ScannedFile[] {
	const { projectsDir, state, projectFilter } = opts;
	const results: ScannedFile[] = [];

	for (const filePath of listTranscripts(projectsDir)) {
		let buf: Buffer;
		try {
			buf = fs.readFileSync(filePath);
		} catch {
			continue;
		}

		const cursor: FileCursor | undefined = state.files[filePath];
		const startByte = cursor ? Math.min(cursor.bytesUploaded, buf.length) : 0;

		// Truncation / rotation guard: if the file shrank below the cursor, the
		// underlying file changed identity — restart from 0.
		const safeStart = buf.length < startByte ? 0 : startByte;
		if (safeStart >= buf.length) {
			continue; // nothing new
		}

		const slice = buf.subarray(safeStart);
		const text = slice.toString("utf8");
		const rawLines = text.split("\n");

		// The cursor always lands on a newline boundary, so the slice begins on a
		// fresh line. A trailing element after the final `\n` is a partial line
		// still being appended — drop it so its bytes stay un-cursored until the
		// line is complete. `split("\n")` always yields that trailing element
		// (empty if `text` ends in `\n`), so the last element is dropped either way.
		const completeLines = rawLines.slice(0, -1);

		// Bytes consumed = up to and including the last complete line's newline.
		// sha256 covers exactly these bytes (the bytes whose records we send).
		let consumedBytes = 0;
		const records: unknown[] = [];
		let skippedLines = 0;
		let lineCount = 0;

		for (const line of completeLines) {
			// +1 for the newline that terminated this line.
			consumedBytes += Buffer.byteLength(line, "utf8") + 1;
			lineCount++;
			const trimmed = line.trim();
			if (trimmed.length === 0) {
				continue;
			}
			try {
				records.push(JSON.parse(trimmed) as unknown);
			} catch {
				skippedLines++;
			}
		}

		if (records.length === 0) {
			continue; // no parseable new records (or only a partial trailing line)
		}

		const sha256 = crypto
			.createHash("sha256")
			.update(slice.subarray(0, consumedBytes))
			.digest("hex");

		const encodedDir = path.basename(path.dirname(filePath));
		const projectPathAbs = pickProjectPath(records, encodedDir);

		if (projectFilter && !projectPathAbs.includes(projectFilter)) {
			continue;
		}

		const git = gitInfo(projectPathAbs);

		// Privacy gate: Depot only keeps memory for git-remote-backed projects.
		// A directory with no `origin` remote may be a private scratch folder, so
		// its transcripts must never leave this machine — skip it entirely. (The
		// server enforces the same rule, but stopping here means the bytes are
		// never even sent.)
		if (!git.remote) {
			continue;
		}

		const branch = pickBranch(records) ?? git.branch;

		results.push({
			filePath,
			providerSessionId: path.basename(filePath, ".jsonl"),
			projectPathAbs,
			gitRemoteRaw: git.remote,
			gitBranch: branch,
			sha256,
			records,
			newBytesUploaded: safeStart + consumedBytes,
			newLinesUploaded: (cursor?.linesUploaded ?? 0) + lineCount,
			skippedLines,
		});
	}

	return results;
}
