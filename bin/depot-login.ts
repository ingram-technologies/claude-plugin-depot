#!/usr/bin/env node
/**
 * depot-login — connect this machine to Depot via the browser, no token
 * copy-paste. Runs under `node` or `bun`, zero dependencies.
 *
 * Flow: start a localhost loopback server → open the browser to
 * <DEPOT_URL>/cli/login?port=…&state=… → you sign in (if needed) and click
 * Authorize → Depot mints a token and the browser hands it back to this loopback
 * → we save it to <stateDir>/credentials.json (mode 0600). The uploader then
 * just works.
 *
 *   depot-login [--url https://depot.ingram.tech] [--no-open]
 *
 * Env: DEPOT_URL (default https://depot.ingram.tech), XDG_STATE_HOME.
 */

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import http from "node:http";
import os from "node:os";

import { loadConfig } from "../src/config.ts";
import { credentialsPath, saveToken } from "../src/credentials.ts";

const TIMEOUT_MS = 3 * 60 * 1000;

function log(msg = ""): void {
	process.stderr.write(`${msg}\n`);
}

/** Best-effort: open `url` in the default browser across macOS / WSL / Linux. */
function openBrowser(url: string): void {
	const candidates: [string, string[]][] =
		process.platform === "darwin"
			? [["open", [url]]]
			: process.platform === "win32"
				? [["cmd", ["/c", "start", "", url]]]
				: [
						["wslview", [url]], // WSL → Windows default browser
						["xdg-open", [url]],
					];
	for (const [cmd, args] of candidates) {
		try {
			const child = spawn(cmd, args, { stdio: "ignore", detached: true });
			child.on("error", () => {});
			child.unref();
			return;
		} catch {
			// try the next opener
		}
	}
}

function parseArgs(argv: readonly string[]): { url: string | null; open: boolean } {
	let url: string | null = null;
	let open = true;
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--no-open") {
			open = false;
		} else if (a === "--url") {
			url = argv[i + 1] ?? null;
			i++;
		} else if (a.startsWith("--url=")) {
			url = a.slice("--url=".length);
		} else if (a === "--help" || a === "-h") {
			log(
				"depot-login — connect this machine to Depot via the browser.\n\n" +
					"  --url <base>   Depot base URL (default $DEPOT_URL or https://depot.ingram.tech)\n" +
					"  --no-open      Don't auto-open the browser; just print the URL\n",
			);
			process.exit(0);
		}
	}
	return { url, open };
}

async function main(): Promise<void> {
	const cfg = loadConfig([]);
	const { url, open } = parseArgs(process.argv.slice(2));
	const depotUrl = (url ?? cfg.depotUrl).replace(/\/+$/, "");
	const state = randomBytes(16).toString("hex");
	const host = os.hostname();

	const token = await new Promise<string>((resolve, reject) => {
		const server = http.createServer((req, res) => {
			const reqUrl = new URL(req.url ?? "/", "http://127.0.0.1");
			const gotToken = reqUrl.searchParams.get("token");
			const gotState = reqUrl.searchParams.get("state");
			res.setHeader("Access-Control-Allow-Origin", "*");

			if (!gotToken || gotState !== state) {
				res.writeHead(204).end();
				return;
			}
			res.writeHead(200, { "content-type": "text/html" }).end(
				"<!doctype html><meta charset=utf-8><title>depot</title>" +
					"<body style=\"font-family:system-ui;background:#16140f;color:#e8e2d4;" +
					'display:grid;place-items:center;height:100vh;margin:0">' +
					"<p>✓ Connected. You can close this tab and return to your terminal.</p>",
			);
			server.close();
			resolve(gotToken);
		});

		server.on("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const addr = server.address();
			if (!addr || typeof addr === "string") {
				reject(new Error("could not bind a loopback port"));
				return;
			}
			const loginUrl = `${depotUrl}/cli/login?port=${addr.port}&state=${state}&host=${encodeURIComponent(host)}`;
			log("Connecting this machine to Depot.\n");
			log("Opening your browser to approve:");
			log(`  ${loginUrl}\n`);
			log("If it doesn't open, paste that URL into a browser. Waiting…");
			if (open) {
				openBrowser(loginUrl);
			}
		});

		setTimeout(() => {
			server.close();
			reject(new Error("timed out waiting for browser approval"));
		}, TIMEOUT_MS).unref();
	});

	saveToken(cfg.stateDir, token, depotUrl);
	// Deliberately do NOT print the token. It is read from the credentials file
	// by the uploader and (via the MCP headersHelper) by the agent's tools — so it
	// never needs to be copied and never lands in a conversation transcript.
	log("\n✓ Connected to Depot. Token saved (kept private) to:");
	log(`  ${credentialsPath(cfg.stateDir)}`);
	log("\nNothing to copy: the uploader and the agent's MCP tools read it from");
	log("there automatically. Run /reload-plugins (or restart Claude Code) to");
	log("connect the MCP, then /depot:depot-sync to upload your transcripts.");
}

main().catch((err: unknown) => {
	const msg = err instanceof Error ? err.message : String(err);
	log(`\ndepot-login failed: ${msg}`);
	log("You can still connect manually: create a token at <DEPOT_URL>/tokens and");
	log('set export DEPOT_TOKEN="dpt_…" in your shell profile.');
	process.exit(1);
});
