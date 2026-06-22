/**
 * Per-file upload cursor. The state file lives at `<stateDir>/state.json` and
 * maps an absolute transcript path → how far we've uploaded.
 *
 * Cursor design: we track both byte and line offsets. Transcript files only
 * ever GROW (sessions append whole JSON lines), so "new content" is everything
 * past `bytesUploaded`. Lines are tracked too, for human-friendly summaries and
 * as a sanity check. The cursor is advanced ONLY after a successful 2xx, so the
 * uploader is safe to interrupt: a crash mid-upload just re-sends the same
 * lines next run, and the server dedups them by record uuid.
 */

import fs from "node:fs";
import path from "node:path";

export type FileCursor = {
	bytesUploaded: number;
	linesUploaded: number;
	sha256OfLastUpload: string;
	lastRunAt: string;
};

export type StateFile = {
	version: 1;
	files: Record<string, FileCursor>;
};

const EMPTY_STATE: StateFile = { version: 1, files: {} };

function isCursor(value: unknown): value is FileCursor {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const v = value as Record<string, unknown>;
	return (
		typeof v.bytesUploaded === "number" &&
		typeof v.linesUploaded === "number" &&
		typeof v.sha256OfLastUpload === "string" &&
		typeof v.lastRunAt === "string"
	);
}

export function statePath(stateDir: string): string {
	return path.join(stateDir, "state.json");
}

/** Load state defensively; a corrupt file resets to empty rather than crashing. */
export function loadState(stateDir: string): StateFile {
	let raw: unknown;
	try {
		raw = JSON.parse(fs.readFileSync(statePath(stateDir), "utf8")) as unknown;
	} catch {
		return { version: 1, files: {} };
	}

	if (typeof raw !== "object" || raw === null) {
		return { version: 1, files: {} };
	}
	const obj = raw as Record<string, unknown>;
	const rawFiles =
		typeof obj.files === "object" && obj.files !== null
			? (obj.files as Record<string, unknown>)
			: {};

	const files: Record<string, FileCursor> = {};
	for (const [key, value] of Object.entries(rawFiles)) {
		if (isCursor(value)) {
			files[key] = value;
		}
	}
	return { version: 1, files };
}

/** Atomic write: write to a temp file then rename, so a crash never truncates. */
export function saveState(stateDir: string, state: StateFile): void {
	fs.mkdirSync(stateDir, { recursive: true });
	const target = statePath(stateDir);
	const tmp = `${target}.tmp-${process.pid}`;
	fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
	fs.renameSync(tmp, target);
}

export function emptyState(): StateFile {
	return { version: 1, files: { ...EMPTY_STATE.files } };
}
