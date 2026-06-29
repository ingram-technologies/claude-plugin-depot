#!/usr/bin/env node
/**
 * MCP `headersHelper` for the bundled Depot server. Claude Code runs this at MCP
 * connection time and uses its stdout (a JSON object of headers) to authenticate
 * the server — so the token is read from the locally-saved credentials (or
 * DEPOT_TOKEN env) at connect time and NEVER passes through a model turn or the
 * conversation transcript.
 *
 * Always emits valid JSON on stdout and exits 0: with no token it returns `{}`
 * (the server then 401s and shows as "needs auth", rather than the whole config
 * failing to parse). Reuses the same token resolution as the uploader.
 */

import { loadConfig } from "../src/config.ts";

try {
	const token = loadConfig([]).token;
	process.stdout.write(
		token ? JSON.stringify({ Authorization: `Bearer ${token}` }) : "{}",
	);
} catch {
	process.stdout.write("{}");
}
