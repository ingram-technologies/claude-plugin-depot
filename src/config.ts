/**
 * Runtime configuration for the depot-upload CLI. Everything comes from the
 * environment (so the same binary works from a shell, a cron job, or a Claude
 * Code hook) plus a small set of flags. No dependencies — plain Node/Bun.
 */

import os from "node:os";
import path from "node:path";

import { readSavedToken } from "./credentials.ts";

export type Flags = {
	once: boolean;
	watch: boolean;
	watchSeconds: number;
	dryRun: boolean;
	project: string | null;
	verbose: boolean;
};

export type Config = {
	depotUrl: string;
	token: string | null;
	accountIdOverride: string | null;
	projectsDir: string;
	stateDir: string;
	maxRecordsPerRequest: number;
	flags: Flags;
};

const DEFAULT_DEPOT_URL = "https://depot.ingram.tech";
const DEFAULT_WATCH_SECONDS = 60;
const MAX_RECORDS_PER_REQUEST = 1000;

/** `~/.claude/projects` unless overridden. */
function defaultProjectsDir(): string {
	const override = process.env.DEPOT_PROJECTS_DIR;
	if (override && override.trim().length > 0) {
		return path.resolve(override.trim());
	}
	return path.join(os.homedir(), ".claude", "projects");
}

/**
 * Where the cursor + machine identity live. Prefer `$XDG_STATE_HOME/depot`,
 * else `~/.claude/depot` (kept next to the transcripts it tracks).
 */
function defaultStateDir(): string {
	const xdg = process.env.XDG_STATE_HOME;
	if (xdg && xdg.trim().length > 0) {
		return path.join(path.resolve(xdg.trim()), "depot");
	}
	return path.join(os.homedir(), ".claude", "depot");
}

function parseWatchSeconds(raw: string | undefined): number {
	if (!raw) {
		return DEFAULT_WATCH_SECONDS;
	}
	const n = Number.parseInt(raw, 10);
	if (!Number.isFinite(n) || n < 1) {
		return DEFAULT_WATCH_SECONDS;
	}
	return n;
}

export function parseFlags(argv: readonly string[]): Flags {
	const flags: Flags = {
		once: true,
		watch: false,
		watchSeconds: DEFAULT_WATCH_SECONDS,
		dryRun: false,
		project: null,
		verbose: false,
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--once":
				flags.once = true;
				flags.watch = false;
				break;
			case "--watch":
				flags.watch = true;
				flags.once = false;
				break;
			case "--watch-seconds": {
				const next = argv[i + 1];
				flags.watchSeconds = parseWatchSeconds(next);
				i++;
				break;
			}
			case "--dry-run":
				flags.dryRun = true;
				break;
			case "--project": {
				const next = argv[i + 1];
				flags.project = next && next.length > 0 ? next : null;
				i++;
				break;
			}
			case "--verbose":
			case "-v":
				flags.verbose = true;
				break;
			default:
				// Support `--flag=value` for project / watch-seconds.
				if (arg.startsWith("--project=")) {
					flags.project = arg.slice("--project=".length) || null;
				} else if (arg.startsWith("--watch-seconds=")) {
					flags.watchSeconds = parseWatchSeconds(
						arg.slice("--watch-seconds=".length),
					);
				}
				break;
		}
	}

	if (flags.watch) {
		flags.watchSeconds = parseWatchSeconds(
			process.env.DEPOT_WATCH_SECONDS ?? String(flags.watchSeconds),
		);
	}

	return flags;
}

export function loadConfig(argv: readonly string[]): Config {
	const depotUrl = (process.env.DEPOT_URL ?? DEFAULT_DEPOT_URL).replace(/\/+$/, "");
	const stateDir = defaultStateDir();
	// Prefer an explicit env token; otherwise fall back to the token saved by
	// `depot login` (so the uploader just works after a browser login).
	const envToken = process.env.DEPOT_TOKEN;
	const token =
		envToken && envToken.trim().length > 0
			? envToken.trim()
			: readSavedToken(stateDir);
	const accountIdOverride = process.env.DEPOT_ACCOUNT_ID ?? null;

	return {
		depotUrl,
		token: token && token.trim().length > 0 ? token.trim() : null,
		accountIdOverride:
			accountIdOverride && accountIdOverride.trim().length > 0
				? accountIdOverride.trim()
				: null,
		projectsDir: defaultProjectsDir(),
		stateDir,
		maxRecordsPerRequest: MAX_RECORDS_PER_REQUEST,
		flags: parseFlags(argv),
	};
}
