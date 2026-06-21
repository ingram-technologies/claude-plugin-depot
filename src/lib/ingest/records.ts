/**
 * Record ingestion. Normalize each raw JSONL record via the parser, then dedup
 * by the producer's own `uuid` with `insert … onConflictDoNothing` (batched).
 * Re-uploading the same records inserts nothing — idempotency is sacred.
 *
 * `seq` is assigned by array order as received (a tie-breaker for `ts`).
 */

import { db, schema } from "@/lib/db";
import { normalizeRecord } from "@/lib/parser";

import type { Tx } from "./tx";

const { transcriptRecord } = schema;

const CHUNK = 500;

export type IngestRecordsResult = {
  inserted: number;
  deduped: number;
  /** uuids of records this batch normalized (new + already-present). */
  uuids: string[];
};

type Row = typeof transcriptRecord.$inferInsert;

/**
 * Insert normalized records for a session, deduped by uuid. Returns counts.
 * `deduped` = records that normalized fine but were already present (or were
 * duplicated within this same batch).
 */
export async function ingestRecords(
  sessionId: string,
  providerSessionId: string,
  fileId: string,
  rawRecords: unknown[],
  conn: Tx = db,
): Promise<IngestRecordsResult> {
  const rows: Row[] = [];
  const seenInBatch = new Set<string>();
  const uuids: string[] = [];
  let normalizedDupes = 0;

  rawRecords.forEach((raw, index) => {
    const n = normalizeRecord(raw);
    if (!n) {
      return; // un-normalizable (e.g. summary lines) — skip silently
    }
    if (seenInBatch.has(n.uuid)) {
      normalizedDupes += 1;
      return;
    }
    seenInBatch.add(n.uuid);
    uuids.push(n.uuid);
    rows.push({
      uuid: n.uuid,
      parentUuid: n.parentUuid,
      sessionId,
      providerSessionId,
      recordType: n.recordType,
      subtype: n.subtype,
      isSidechain: n.isSidechain,
      isMeta: n.isMeta,
      role: n.role,
      model: n.model,
      cwd: n.cwd,
      gitBranch: n.gitBranch,
      ts: n.ts,
      seq: index,
      inputTokens: n.inputTokens,
      outputTokens: n.outputTokens,
      cacheReadTokens: n.cacheReadTokens,
      textContent: n.textContent,
      toolName: n.toolName,
      raw: n.raw,
      firstSeenFileId: fileId,
    });
  });

  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const ret = await conn
      .insert(transcriptRecord)
      .values(chunk)
      .onConflictDoNothing({ target: transcriptRecord.uuid })
      .returning({ uuid: transcriptRecord.uuid });
    inserted += ret.length;
  }

  // Everything we normalized but did not freshly insert is a dedup hit
  // (either already in DB, or a within-batch duplicate uuid).
  const deduped = uuids.length - inserted + normalizedDupes;

  return { inserted, deduped, uuids };
}
