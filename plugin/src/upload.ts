/**
 * HTTP upload to `POST {DEPOT_URL}/api/ingest`. Each ScannedFile is uploaded;
 * files whose record count exceeds the per-request cap are split into multiple
 * requests (same sha256 — the server dedups files by sha and records by uuid).
 * Network errors retry with exponential backoff. The cursor is advanced (by the
 * caller) ONLY after every chunk of a file has returned 2xx.
 */

import type { Account, Machine } from "./identity.ts";
import type { ScannedFile } from "./scan.ts";

export type IngestResponse = {
	ok: boolean;
	files?: { accepted: number; duplicate: number };
	records?: { inserted: number; deduped: number };
	sessions?: unknown[];
	error?: string;
};

export type UploadResult = {
	filePath: string;
	providerSessionId: string;
	ok: boolean;
	recordsSent: number;
	chunks: number;
	inserted: number;
	deduped: number;
	error?: string;
};

export type UploaderOptions = {
	depotUrl: string;
	token: string;
	machine: Machine;
	account: Account;
	maxRecordsPerRequest: number;
	verbose: boolean;
	log: (msg: string) => void;
};

const MAX_ATTEMPTS = 4;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkRecords(records: unknown[], size: number): unknown[][] {
	if (records.length <= size) {
		return [records];
	}
	const chunks: unknown[][] = [];
	for (let i = 0; i < records.length; i += size) {
		chunks.push(records.slice(i, i + size));
	}
	return chunks;
}

function buildAccountPayload(account: Account): {
	vendor: "anthropic";
	vendorAccountId: string;
	email?: string;
} {
	const payload: { vendor: "anthropic"; vendorAccountId: string; email?: string } = {
		vendor: "anthropic",
		vendorAccountId: account.vendorAccountId,
	};
	if (account.email) {
		payload.email = account.email;
	}
	return payload;
}

/** POST one request body, retrying transient failures with backoff. */
async function postWithRetry(
	url: string,
	token: string,
	body: unknown,
	verbose: boolean,
	log: (msg: string) => void,
): Promise<IngestResponse> {
	let lastError = "unknown error";

	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		try {
			const res = await fetch(url, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${token}`,
				},
				body: JSON.stringify(body),
			});

			const text = await res.text();
			let parsed: IngestResponse;
			try {
				parsed = JSON.parse(text) as IngestResponse;
			} catch {
				parsed = { ok: res.ok, error: res.ok ? undefined : text.slice(0, 200) };
			}

			if (res.ok) {
				return { ...parsed, ok: true };
			}

			// 4xx (except 429) is a permanent failure — do not retry.
			if (res.status >= 400 && res.status < 500 && res.status !== 429) {
				return {
					ok: false,
					error: parsed.error ?? `HTTP ${res.status}`,
				};
			}
			lastError = parsed.error ?? `HTTP ${res.status}`;
		} catch (err) {
			lastError = err instanceof Error ? err.message : "network error";
		}

		if (attempt < MAX_ATTEMPTS) {
			const backoff = 500 * 2 ** (attempt - 1);
			if (verbose) {
				log(`  retry ${attempt}/${MAX_ATTEMPTS - 1} after ${backoff}ms: ${lastError}`);
			}
			await sleep(backoff);
		}
	}

	return { ok: false, error: lastError };
}

/** Upload a single file (possibly across several chunked requests). */
export async function uploadFile(
	file: ScannedFile,
	opts: UploaderOptions,
): Promise<UploadResult> {
	const url = `${opts.depotUrl}/api/ingest`;
	const chunks = chunkRecords(file.records, opts.maxRecordsPerRequest);

	let inserted = 0;
	let deduped = 0;

	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];
		const body = {
			machine: opts.machine,
			account: buildAccountPayload(opts.account),
			files: [
				{
					providerSessionId: file.providerSessionId,
					projectPathAbs: file.projectPathAbs,
					...(file.gitRemoteRaw ? { gitRemoteRaw: file.gitRemoteRaw } : {}),
					...(file.gitBranch ? { gitBranch: file.gitBranch } : {}),
					sha256: file.sha256,
					records: chunk,
				},
			],
		};

		const res = await postWithRetry(url, opts.token, body, opts.verbose, opts.log);
		if (!res.ok) {
			return {
				filePath: file.filePath,
				providerSessionId: file.providerSessionId,
				ok: false,
				recordsSent: file.records.length,
				chunks: chunks.length,
				inserted,
				deduped,
				error: res.error ?? "upload failed",
			};
		}
		inserted += res.records?.inserted ?? 0;
		deduped += res.records?.deduped ?? 0;

		if (opts.verbose && chunks.length > 1) {
			opts.log(
				`  chunk ${i + 1}/${chunks.length}: +${res.records?.inserted ?? 0} inserted`,
			);
		}
	}

	return {
		filePath: file.filePath,
		providerSessionId: file.providerSessionId,
		ok: true,
		recordsSent: file.records.length,
		chunks: chunks.length,
		inserted,
		deduped,
	};
}
