#!/usr/bin/env node
/**
 * depot-upload — ship NEW Claude Code transcript records to Depot, incrementally
 * and idempotently. Runs under `node` or `bun`, zero dependencies.
 *
 *   depot-upload [--once] [--watch [--watch-seconds N]] [--dry-run]
 *                [--project <substr>] [--verbose]
 *
 * Env:
 *   DEPOT_URL          default https://depot.ingram.tech
 *   DEPOT_TOKEN        required (unless --dry-run)
 *   DEPOT_ACCOUNT_ID   optional account-id override
 *   DEPOT_PROJECTS_DIR optional, default ~/.claude/projects
 *   DEPOT_WATCH_SECONDS optional poll interval for --watch
 */

import { loadConfig } from "../src/config.ts";
import { formatSummary, runOnce } from "../src/run.ts";

const HELP = `depot-upload — upload Claude Code transcripts to Depot

Usage:
  depot-upload [options]

Options:
  --once               Run a single upload pass and exit (default)
  --watch              Poll continuously, uploading new records each interval
  --watch-seconds N    Poll interval for --watch (default 60)
  --dry-run            Print what would be sent (counts only); no network, no
                       cursor changes
  --project <substr>   Only upload sessions whose project path contains <substr>
  --verbose, -v        Verbose per-file logging
  --help, -h           Show this help

Env: DEPOT_URL, DEPOT_TOKEN (required), DEPOT_ACCOUNT_ID, DEPOT_PROJECTS_DIR
`;

function log(msg: string): void {
	process.stderr.write(`${msg}\n`);
}

async function main(): Promise<number> {
	const argv = process.argv.slice(2);
	if (argv.includes("--help") || argv.includes("-h")) {
		process.stdout.write(HELP);
		return 0;
	}

	const config = loadConfig(argv);

	// Fatal config check: a real upload needs a token.
	if (!config.flags.dryRun && !config.token) {
		log("error: DEPOT_TOKEN is not set (required unless --dry-run)");
		return 2;
	}

	if (config.flags.watch) {
		log(
			`depot-upload watching ${config.projectsDir} every ` +
				`${config.flags.watchSeconds}s (Ctrl-C to stop)`,
		);
		// Watch loop: never exits on transient upload failures — it logs and
		// retries next interval. The cursor protects against duplicate sends.
		for (;;) {
			try {
				const summary = await runOnce(config, log);
				const line = formatSummary(summary);
				if (summary.scannedFiles > 0 || config.flags.verbose) {
					log(line);
				}
			} catch (err) {
				log(`error: ${err instanceof Error ? err.message : String(err)}`);
			}
			await new Promise((resolve) =>
				setTimeout(resolve, config.flags.watchSeconds * 1000),
			);
		}
	}

	// Single pass.
	const summary = await runOnce(config, log);
	process.stdout.write(`${formatSummary(summary)}\n`);

	if (summary.errors.length > 0 && summary.uploadedFiles === 0) {
		for (const e of summary.errors) {
			log(`error: ${e}`);
		}
		return 1;
	}
	return 0;
}

main()
	.then((code) => process.exit(code))
	.catch((err) => {
		log(`fatal: ${err instanceof Error ? err.message : String(err)}`);
		process.exit(1);
	});
