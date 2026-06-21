/**
 * Parse a whole `.jsonl` transcript into normalized records. Pure: operates on
 * a string, never touches fs/db. Tolerant by design — a malformed or partial
 * line is collected as an error and skipped, never thrown.
 */

import { normalizeRecord } from "./normalize";
import type { NormalizedRecord } from "./types";

export type ParseError = {
	/** 1-based line number within the input. */
	line: number;
	message: string;
};

export type ParseResult = {
	records: NormalizedRecord[];
	errors: ParseError[];
};

/**
 * Split on newlines and JSON-parse + normalize each non-empty line. Records
 * can be ~1MB, and a truncated trailing line is reported rather than fatal.
 */
export function parseTranscript(text: string): ParseResult {
	const records: NormalizedRecord[] = [];
	const errors: ParseError[] = [];

	// Split on \n; tolerate \r\n. Empty/whitespace lines are skipped silently.
	const lines = text.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i]?.trim();
		if (!trimmed) continue;

		let value: unknown;
		try {
			value = JSON.parse(trimmed);
		} catch (err) {
			errors.push({
				line: i + 1,
				message: err instanceof Error ? err.message : "invalid JSON",
			});
			continue;
		}

		const record = normalizeRecord(value);
		if (record === null) {
			errors.push({ line: i + 1, message: "record has no usable uuid" });
			continue;
		}
		records.push(record);
	}

	return { records, errors };
}
