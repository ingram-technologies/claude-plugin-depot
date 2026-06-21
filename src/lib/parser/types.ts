/**
 * Parser types. A {@link RawRecord} is one untrusted JSON object from a
 * transcript line; a {@link NormalizedRecord} is the projection consumed by the
 * `transcript_record` table (see src/lib/schema.ts).
 */

/** One raw transcript line, parsed but not validated. */
export type RawRecord = Record<string, unknown>;

/**
 * The exact set of fields the `transcript_record` table projects. `seq` and the
 * `*_at` audit columns are assigned at ingest time, not by the parser, so they
 * are intentionally absent here.
 */
export type NormalizedRecord = {
	uuid: string;
	parentUuid: string | null;
	providerSessionId: string | null;
	recordType: string;
	subtype: string | null;
	isSidechain: boolean;
	isMeta: boolean;
	role: string | null;
	model: string | null;
	cwd: string | null;
	gitBranch: string | null;
	ts: Date | null;
	inputTokens: number | null;
	outputTokens: number | null;
	cacheReadTokens: number | null;
	textContent: string | null;
	toolName: string | null;
	/** The original, verbatim object — stored as `raw` jsonb. */
	raw: RawRecord;
};
