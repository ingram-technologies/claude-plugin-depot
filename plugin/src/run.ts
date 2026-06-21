/**
 * One upload pass: scan → upload each file → advance its cursor on success.
 * The cursor for a file advances ONLY after that file's upload fully succeeds,
 * so the pass is idempotent and safe to interrupt.
 */

import type { Config } from "./config.ts";
import { resolveAccount, resolveMachine } from "./identity.ts";
import { scan } from "./scan.ts";
import { loadState, saveState, type StateFile } from "./state.ts";
import { uploadFile, type UploaderOptions } from "./upload.ts";

export type RunSummary = {
	scannedFiles: number;
	uploadedFiles: number;
	failedFiles: number;
	recordsSent: number;
	inserted: number;
	deduped: number;
	skippedLines: number;
	dryRun: boolean;
	errors: string[];
};

export async function runOnce(config: Config, log: (msg: string) => void): Promise<RunSummary> {
	const machine = resolveMachine(config.stateDir);
	const account = resolveAccount(config.accountIdOverride);
	const state: StateFile = loadState(config.stateDir);

	const files = scan({
		projectsDir: config.projectsDir,
		state,
		projectFilter: config.flags.project,
	});

	const summary: RunSummary = {
		scannedFiles: files.length,
		uploadedFiles: 0,
		failedFiles: 0,
		recordsSent: 0,
		inserted: 0,
		deduped: 0,
		skippedLines: 0,
		dryRun: config.flags.dryRun,
		errors: [],
	};

	if (config.flags.verbose) {
		log(`account: ${account.vendorAccountId} (source: ${account.source})`);
		log(`machine: ${machine.fingerprint.slice(0, 12)}… (${machine.os})`);
		log(`scanned ${files.length} file(s) with new records`);
	}

	for (const file of files) {
		summary.skippedLines += file.skippedLines;
	}

	if (config.flags.dryRun) {
		for (const file of files) {
			summary.recordsSent += file.records.length;
			log(
				`[dry-run] ${file.providerSessionId}: ${file.records.length} new record(s)` +
					`${file.skippedLines > 0 ? `, ${file.skippedLines} malformed` : ""}` +
					` — ${file.projectPathAbs}`,
			);
		}
		return summary;
	}

	if (!config.token) {
		summary.errors.push("DEPOT_TOKEN is not set");
		return summary;
	}

	const uploaderOpts: UploaderOptions = {
		depotUrl: config.depotUrl,
		token: config.token,
		machine,
		account,
		maxRecordsPerRequest: config.maxRecordsPerRequest,
		verbose: config.flags.verbose,
		log,
	};

	for (const file of files) {
		const result = await uploadFile(file, uploaderOpts);
		summary.recordsSent += result.recordsSent;

		if (!result.ok) {
			summary.failedFiles += 1;
			summary.errors.push(`${file.providerSessionId}: ${result.error ?? "failed"}`);
			if (config.flags.verbose) {
				log(`✗ ${file.providerSessionId}: ${result.error ?? "failed"}`);
			}
			continue; // cursor NOT advanced — retried next run
		}

		summary.uploadedFiles += 1;
		summary.inserted += result.inserted;
		summary.deduped += result.deduped;

		// Advance + persist this file's cursor immediately on success, so an
		// interrupt later in the pass never loses already-committed progress.
		state.files[file.filePath] = {
			bytesUploaded: file.newBytesUploaded,
			linesUploaded: file.newLinesUploaded,
			sha256OfLastUpload: file.sha256,
			lastRunAt: new Date().toISOString(),
		};
		saveState(config.stateDir, state);

		if (config.flags.verbose) {
			log(
				`✓ ${file.providerSessionId}: +${result.inserted} inserted, ` +
					`${result.deduped} deduped (${result.chunks} chunk(s))`,
			);
		}
	}

	return summary;
}

export function formatSummary(summary: RunSummary): string {
	if (summary.dryRun) {
		return (
			`dry-run: ${summary.scannedFiles} file(s), ${summary.recordsSent} new ` +
			`record(s) would be sent` +
			(summary.skippedLines > 0 ? `, ${summary.skippedLines} malformed skipped` : "")
		);
	}
	const parts = [
		`${summary.uploadedFiles}/${summary.scannedFiles} file(s) uploaded`,
		`${summary.inserted} inserted`,
		`${summary.deduped} deduped`,
	];
	if (summary.failedFiles > 0) {
		parts.push(`${summary.failedFiles} failed`);
	}
	if (summary.skippedLines > 0) {
		parts.push(`${summary.skippedLines} malformed skipped`);
	}
	return parts.join(", ");
}
