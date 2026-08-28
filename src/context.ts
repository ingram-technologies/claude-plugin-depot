/**
 * The push channel: inject Depot's memory into a session *unprompted*, via two
 * Claude Code hooks that both enter through `bin/depot-context.ts`:
 *
 *  - SessionStart — fetch the project brief for the repo the session sits in
 *    (keyed by its git remote, the same identity ingest uses) and emit it as
 *    `additionalContext`. The response's `hotFiles` list is cached locally.
 *  - PreToolUse (Edit/Write/NotebookEdit) — when the file about to be edited is
 *    on the cached hot list, fetch its dossier (what failed here, what fixed
 *    it) and inject it once per session per file. Ordinary edits — anything
 *    not on the list — cost ZERO network calls. The repo is the FILE's repo,
 *    not the session's starting cwd: a session that edits across repos gets
 *    each repo's dossiers, and an unseen repo's hot list is fetched once (then
 *    cached like SessionStart's).
 *
 * Every failure is silent (no token, offline, unknown project, timeout): the
 * hook must never slow down or break a session. Depot missing entirely must
 * feel like Depot not installed.
 */

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type HookInput = {
	hookEventName: string;
	sessionId: string | null;
	cwd: string | null;
	filePath: string | null;
	/** SessionStart only: startup | resume | clear | compact (null pre-field). */
	source: string | null;
};

type CachedContext = {
	fetchedAt: string;
	remote: string;
	payload: {
		project?: { slug?: string };
		brief?: string;
		hotFiles?: { path: string }[];
	};
};

/** How long a SessionStart-cached hot list stays usable by pre-edit hooks. */
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
/** Injected-set files older than this are pruned (dead sessions). */
const INJECTED_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3500;

function asRecord(value: unknown): Record<string, unknown> | null {
	if (typeof value === "object" && value !== null && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return null;
}

function asString(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

/** Parse the hook's stdin JSON. Field names follow the hooks contract
 *  (snake_case); tolerate anything missing — callers guard on nulls. */
export function parseHookInput(stdin: string): HookInput | null {
	let raw: unknown;
	try {
		raw = JSON.parse(stdin) as unknown;
	} catch {
		return null;
	}
	const obj = asRecord(raw);
	if (!obj) {
		return null;
	}
	const toolInput = asRecord(obj.tool_input);
	return {
		hookEventName: asString(obj.hook_event_name) ?? "",
		sessionId: asString(obj.session_id),
		cwd: asString(obj.cwd),
		// Edit/Write carry file_path; NotebookEdit carries notebook_path.
		filePath: toolInput
			? (asString(toolInput.file_path) ?? asString(toolInput.notebook_path))
			: null,
		source: asString(obj.source),
	};
}

function git(cwd: string, args: string[]): string | null {
	try {
		const out = execFileSync("git", ["-C", cwd, ...args], {
			encoding: "utf8",
			timeout: 1500,
			stdio: ["ignore", "pipe", "ignore"],
		});
		const trimmed = out.trim();
		return trimmed.length > 0 ? trimmed : null;
	} catch {
		return null;
	}
}

export function originRemote(cwd: string): string | null {
	return git(cwd, ["remote", "get-url", "origin"]);
}

function repoRoot(cwd: string): string | null {
	return git(cwd, ["rev-parse", "--show-toplevel"]);
}

function contextDir(stateDir: string): string {
	return path.join(stateDir, "context");
}

function cachePath(stateDir: string, remote: string): string {
	const key = crypto.createHash("sha256").update(remote).digest("hex").slice(0, 24);
	return path.join(contextDir(stateDir), `project-${key}.json`);
}

function injectedPath(stateDir: string, sessionId: string): string {
	const key = crypto
		.createHash("sha256")
		.update(sessionId)
		.digest("hex")
		.slice(0, 24);
	return path.join(contextDir(stateDir), `injected-${key}.json`);
}

function readJson(file: string): unknown {
	try {
		return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
	} catch {
		return null;
	}
}

function writeJson(file: string, value: unknown): void {
	try {
		fs.mkdirSync(path.dirname(file), { recursive: true });
		const tmp = `${file}.tmp-${process.pid}`;
		fs.writeFileSync(tmp, JSON.stringify(value), { mode: 0o600 });
		fs.renameSync(tmp, file);
	} catch {
		// State is an optimization; losing it only costs a refetch.
	}
}

function loadCache(stateDir: string, remote: string): CachedContext | null {
	const obj = asRecord(readJson(cachePath(stateDir, remote)));
	if (!obj) {
		return null;
	}
	const fetchedAt = asString(obj.fetchedAt);
	const payload = asRecord(obj.payload);
	if (!fetchedAt || !payload) {
		return null;
	}
	if (Date.now() - new Date(fetchedAt).getTime() > CACHE_TTL_MS) {
		return null;
	}
	return { fetchedAt, remote, payload };
}

/** Drop stale injected-set files so the context dir never grows unbounded. */
function pruneInjected(stateDir: string): void {
	try {
		const dir = contextDir(stateDir);
		for (const name of fs.readdirSync(dir)) {
			if (!name.startsWith("injected-")) {
				continue;
			}
			const file = path.join(dir, name);
			const age = Date.now() - fs.statSync(file).mtimeMs;
			if (age > INJECTED_TTL_MS) {
				fs.unlinkSync(file);
			}
		}
	} catch {
		// Best-effort hygiene only.
	}
}

async function fetchContext(
	depotUrl: string,
	token: string,
	remote: string,
	filePath?: string,
): Promise<Record<string, unknown> | null> {
	const params = new URLSearchParams({ remote });
	if (filePath !== undefined) {
		params.set("path", filePath);
	}
	try {
		const res = await fetch(`${depotUrl}/api/v1/context?${params}`, {
			headers: { authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});
		if (!res.ok) {
			return null;
		}
		return asRecord((await res.json()) as unknown);
	} catch {
		return null;
	}
}

function emit(hookEventName: string, additionalContext: string): void {
	process.stdout.write(
		JSON.stringify({
			hookSpecificOutput: { hookEventName, additionalContext },
		}),
	);
}

export type ContextEnv = { depotUrl: string; token: string; stateDir: string };

/** SessionStart: inject the project brief; cache the hot-file gate. */
export async function runSessionStart(
	input: HookInput,
	env: ContextEnv,
): Promise<void> {
	const cwd = input.cwd;
	if (!cwd) {
		return;
	}
	// A resumed/compacted session already carries the brief (verbatim or in the
	// compaction summary) — re-injecting it would duplicate context. Missing
	// `source` (older Claude Code) is treated as a fresh start.
	if (input.source === "resume" || input.source === "compact") {
		return;
	}
	const remote = originRemote(cwd);
	if (!remote) {
		return; // Not a remote-backed repo — Depot has no memory of it (by design).
	}
	pruneInjected(env.stateDir);
	const payload = await fetchContext(env.depotUrl, env.token, remote);
	if (!payload) {
		return;
	}
	writeJson(cachePath(env.stateDir, remote), {
		fetchedAt: new Date().toISOString(),
		remote,
		payload,
	});
	const brief = asString(payload.brief);
	if (!brief) {
		return;
	}
	emit(
		"SessionStart",
		[
			"Depot institutional memory for this repository (distilled from the team's past sessions; every claim links to transcript evidence):",
			"",
			brief,
			"",
			"Before editing a file listed under friction hotspots, call the depot_file_context MCP tool for its failure history.",
		].join("\n"),
	);
}

/** PreToolUse (Edit/Write/NotebookEdit): inject a hot file's dossier, once. */
export async function runPreToolUse(input: HookInput, env: ContextEnv): Promise<void> {
	const { cwd, filePath, sessionId } = input;
	if (!cwd || !filePath || !sessionId) {
		return;
	}
	// Key on the repo the FILE lives in — a session is not one place.
	const fileAbs = path.resolve(cwd, filePath);
	const fileDir = path.dirname(fileAbs);
	const remote = originRemote(fileDir);
	if (!remote) {
		return;
	}
	// Gate on the cached hot list — never hit the network for a file Depot has
	// no friction record of. A repo this session hasn't seen yet (the file sits
	// outside the starting repo) costs one fetch to learn its hot list, cached
	// for the same TTL as SessionStart's; after that its edits are free too.
	let cache = loadCache(env.stateDir, remote);
	if (!cache) {
		const payload = await fetchContext(env.depotUrl, env.token, remote);
		const fetchedAt = new Date().toISOString();
		// Cache a miss as an empty payload so an unknown repo is asked once.
		writeJson(cachePath(env.stateDir, remote), {
			fetchedAt,
			remote,
			payload: payload ?? {},
		});
		cache = { fetchedAt, remote, payload: payload ?? {} };
	}
	const root = repoRoot(fileDir);
	if (!root) {
		return;
	}
	const rel = path.relative(root, fileAbs);
	if (rel.startsWith("..") || path.isAbsolute(rel)) {
		return;
	}
	const hot = (cache.payload.hotFiles ?? []).some((f) => f.path === rel);
	if (!hot) {
		return;
	}

	const injectedFile = injectedPath(env.stateDir, sessionId);
	const injectedRaw = readJson(injectedFile);
	const injected = Array.isArray(injectedRaw)
		? injectedRaw.filter((v): v is string => typeof v === "string")
		: [];
	if (injected.includes(rel)) {
		return; // Once per file per session — repetition is noise.
	}
	// Record BEFORE fetching: a null/failed fetch also shouldn't retry on
	// every subsequent edit of the same file in this session.
	writeJson(injectedFile, [...injected, rel]);

	const payload = await fetchContext(env.depotUrl, env.token, remote, rel);
	const context = payload ? asString(payload.context) : null;
	if (!context) {
		return;
	}
	emit(
		"PreToolUse",
		[
			`Depot: the file you are about to edit (${rel}) has recorded friction. Its dossier:`,
			"",
			context,
		].join("\n"),
	);
}

/** Entry point: route by hook event; absolutely never throw. */
export async function runContextHook(stdin: string, env: ContextEnv): Promise<void> {
	const input = parseHookInput(stdin);
	if (!input) {
		return;
	}
	if (input.hookEventName === "SessionStart") {
		await runSessionStart(input, env);
	} else if (input.hookEventName === "PreToolUse") {
		await runPreToolUse(input, env);
	}
}
