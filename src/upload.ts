/**
 * HTTP upload to `POST {DEPOT_URL}/api/ingest`. Each ScannedFile is uploaded;
 * files are split into multiple requests by BYTE size (same sha256 — the server
 * dedups files by sha and records by uuid). Network errors retry with
 * exponential backoff. The cursor is advanced (by the caller) ONLY after every
 * chunk of a file has returned 2xx.
 *
 * Why byte-aware chunking (not record-count): Vercel serverless rejects a
 * request body over ~4.5 MB *before our handler runs*, so the uploader — not the
 * server — must bound every request. Record count can't bound bytes (1000 small
 * records and 1000 megabyte ones differ by orders of magnitude). Two ceilings
 * make the guarantee total:
 *   1. REQUEST_BUDGET caps the serialized records packed into one request.
 *   2. PER_RECORD_BUDGET caps a SINGLE record. A record larger than a request
 *      can't be split across requests, so its oversized strings (a pasted
 *      megabyte, a base64 image in a tool_result — noise for memory extraction)
 *      are shed to a marker. After shedding, every record fits in a request and
 *      byte-packing can always make progress, so "body too large" is impossible.
 * sha256 is computed over the original file bytes (see scan.ts), so shedding the
 * in-memory upload copy never affects file dedup or the cursor: re-uploading the
 * same bytes still no-ops.
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

/** Serialized records packed into one request (headroom under Vercel's ~4.5 MB). */
const REQUEST_BUDGET_BYTES = 3_500_000;
/** A single record may not exceed this on the wire; over it, its strings are shed. */
const PER_RECORD_BUDGET_BYTES = 3_000_000;
/** First-pass cap on any one string when shedding an oversized record (128 KB). */
const MAX_STRING_BYTES = 131_072;
/** Second-pass cap, only if a record is *still* over budget after the first (8 KB). */
const SMALL_STRING_BYTES = 8_192;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function utf8Len(value: string): number {
	return Buffer.byteLength(value, "utf8");
}

/**
 * Replace every string longer than `max` bytes (deep, anywhere in the value)
 * with a truncated preview plus a byte-count marker. Returns the input
 * unchanged — same reference — when nothing is over the limit, so the common
 * record is never copied. Used only to shed a single oversized record down to
 * something one request can carry.
 */
export function shedLargeStrings(value: unknown, max: number): unknown {
	if (typeof value === "string") {
		if (utf8Len(value) <= max) {
			return value;
		}
		const head = value.slice(0, max);
		return `${head}…<truncated ${utf8Len(value) - utf8Len(head)} bytes>`;
	}
	if (Array.isArray(value)) {
		let changed = false;
		const out = value.map((v) => {
			const s = shedLargeStrings(v, max);
			if (s !== v) {
				changed = true;
			}
			return s;
		});
		return changed ? out : value;
	}
	if (value && typeof value === "object") {
		let changed = false;
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value)) {
			const s = shedLargeStrings(v, max);
			if (s !== v) {
				changed = true;
			}
			out[k] = s;
		}
		return changed ? out : value;
	}
	return value;
}

export type PreparedRecord = { record: unknown; bytes: number; truncated: boolean };

/**
 * Serialize each record once, measuring its on-wire UTF-8 size, and shed any
 * record that exceeds PER_RECORD_BUDGET (first the 128 KB cap, then — only if a
 * record is *still* too big, e.g. it carried dozens of large strings — an 8 KB
 * cap that makes exceeding the request budget arithmetically impossible). The
 * returned `bytes` lets the chunker pack by size without re-serializing.
 */
export function prepareRecords(records: unknown[]): {
	prepared: PreparedRecord[];
	truncated: number;
} {
	const prepared: PreparedRecord[] = [];
	let truncated = 0;
	for (const record of records) {
		let value = record;
		let bytes = utf8Len(JSON.stringify(value) ?? "");
		let didTruncate = false;
		if (bytes > PER_RECORD_BUDGET_BYTES) {
			value = shedLargeStrings(value, MAX_STRING_BYTES);
			bytes = utf8Len(JSON.stringify(value) ?? "");
			if (bytes > REQUEST_BUDGET_BYTES) {
				value = shedLargeStrings(value, SMALL_STRING_BYTES);
				bytes = utf8Len(JSON.stringify(value) ?? "");
			}
			didTruncate = true;
			truncated++;
		}
		prepared.push({ record: value, bytes, truncated: didTruncate });
	}
	return { prepared, truncated };
}

/**
 * Greedily pack prepared records into chunks, each under both the byte budget
 * and the record-count cap. A record wider than the budget still goes out alone
 * (it was already shed to fit one request). Always yields ≥1 chunk for a
 * non-empty input.
 */
export function chunkPrepared(
	prepared: PreparedRecord[],
	maxRecords: number,
): unknown[][] {
	const chunks: unknown[][] = [];
	let cur: unknown[] = [];
	let curBytes = 0;
	for (const { record, bytes } of prepared) {
		const wouldExceed =
			cur.length > 0 &&
			(curBytes + bytes > REQUEST_BUDGET_BYTES || cur.length >= maxRecords);
		if (wouldExceed) {
			chunks.push(cur);
			cur = [];
			curBytes = 0;
		}
		cur.push(record);
		curBytes += bytes;
	}
	if (cur.length > 0) {
		chunks.push(cur);
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
				log(
					`  retry ${attempt}/${MAX_ATTEMPTS - 1} after ${backoff}ms: ${lastError}`,
				);
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
	const { prepared, truncated } = prepareRecords(file.records);
	const chunks = chunkPrepared(prepared, opts.maxRecordsPerRequest);

	if (truncated > 0 && opts.verbose) {
		opts.log(
			`  shed oversized content from ${truncated} record(s) to fit the upload limit`,
		);
	}

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
