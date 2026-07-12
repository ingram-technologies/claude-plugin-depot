#!/usr/bin/env node
/**
 * depot-context — Claude Code hook entry for the push channel. Reads the hook
 * event JSON on stdin (SessionStart or PreToolUse) and, when Depot knows the
 * repo, writes `additionalContext` JSON to stdout: the project brief at session
 * start, a file's failure dossier before an edit to a known-hot file.
 *
 * Silent by contract: no token, no network, no project, bad input — all exit 0
 * with no output. A hook must never break or slow a session.
 */

import { loadConfig } from "../src/config.ts";
import { runContextHook } from "../src/context.ts";

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(Buffer.from(chunk));
	}
	return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
	const config = loadConfig([]);
	if (!config.token) {
		return;
	}
	const stdin = await readStdin();
	await runContextHook(stdin, {
		depotUrl: config.depotUrl,
		token: config.token,
		stateDir: config.stateDir,
	});
}

main()
	.catch(() => {})
	.finally(() => process.exit(0));
