/**
 * Stage 2 — Extract (append-only, LLM-driven).
 *
 * Reads one session's main-thread transcript, asks the EXTRACTOR agent for a
 * small set of high-precision claims, and appends them to `knowledge_claim` keyed
 * by a deterministic fingerprint. Re-running over the same records inserts nothing
 * new (idempotent).
 *
 * ## Transcript windowing
 *
 * Transcripts can be huge. We build a compact context from each record's
 * `text_content` (the flattened, human-readable projection — never the raw jsonb)
 * prefixed by the record uuid so the model can cite. Records are truncated per
 * record (PER_RECORD_CHARS) and the whole context is capped (MAX_CONTEXT_CHARS).
 * When a session exceeds the cap we WINDOW to the most recent records that fit
 * (decisions/gotchas/state usually crystallize late in a session), and tell the
 * model the head was elided. We do NOT silently merge windows into one claim set;
 * a single windowed pass is the unit. Chunked multi-pass extraction is a noted
 * follow-up.
 */

import { newId } from "@/lib/ids";
import { execute, maybeOne, query, withTx } from "@/lib/db";
import { runStructured } from "@/lib/agent/client";
import { EXTRACTOR_AGENT } from "@/lib/agent/specs";
import { claimFingerprint } from "./fingerprint";
import { ExtractionResult, type ExtractedClaim } from "./schemas";
// `ExtractedClaim` is exported as both a Zod schema (value) and its inferred type.

/** Hard caps for the assembled context. Conservative; tune with model limits. */
const PER_RECORD_CHARS = 4_000;
const MAX_CONTEXT_CHARS = 120_000;

type RecordRow = {
  uuid: string;
  ts: Date | null;
  text_content: string | null;
  record_type: string;
  role: string | null;
};

export type ExtractStats = {
  sessionId: string;
  recordsConsidered: number;
  recordsWindowed: number;
  claimsProposed: number;
  claimsInserted: number;
  evidenceInserted: number;
  droppedEvidence: number;
};

/** Run the extractor over a single session. Idempotent across re-runs. */
export async function extractSession(sessionId: string): Promise<ExtractStats> {
  const session = await maybeOne<{ id: string; project_id: string | null }>(
    `select id, project_id from session where id = $1`,
    [sessionId],
  );
  if (!session) throw new Error(`Unknown session: ${sessionId}`);
  if (!session.project_id) throw new Error(`Session ${sessionId} has no project; cannot extract.`);
  const projectId = session.project_id;

  const runId = newId("analysisRun");
  await execute(
    `insert into analysis_run (id, kind, status, project_id, session_id, agent_id, model)
		 values ($1, 'extract', 'running', $2, $3, $4, $5)`,
    [
      runId,
      projectId,
      sessionId,
      process.env.DEPOT_EXTRACTOR_AGENT_ID ?? null,
      EXTRACTOR_AGENT.model,
    ],
  );

  try {
    // Main-thread records only (no subagent sidechains), ordered like the index.
    const records = await query<RecordRow>(
      `select uuid, ts, text_content, record_type, role
			 from transcript_record
			 where session_id = $1 and is_sidechain = false and is_meta = false
			 order by ts asc nulls last, seq asc`,
      [sessionId],
    );

    const valid = new Set(records.map((r) => r.uuid));
    const { context, windowedFrom } = buildContext(records);
    const maxTs = records.reduce<Date | null>((acc, r) => {
      if (!r.ts) return acc;
      return acc && acc >= r.ts ? acc : r.ts;
    }, null);

    let claims: ExtractedClaim[] = [];
    if (context.trim().length > 0) {
      const result = await runStructured({
        agent: EXTRACTOR_AGENT,
        schema: ExtractionResult,
        prompt: extractionPrompt(context, windowedFrom),
      });
      claims = result.claims;
    }

    const stats = await persistClaims({
      runId,
      projectId,
      sessionId,
      claims,
      valid,
    });

    // Mark how far this session has been analyzed.
    if (maxTs)
      await execute(`update session set analyzed_through_ts = $1 where id = $2`, [
        maxTs,
        sessionId,
      ]);

    const full: ExtractStats = {
      sessionId,
      recordsConsidered: records.length,
      recordsWindowed: windowedFrom,
      ...stats,
    };
    await execute(
      `update analysis_run set status = 'done', finished_at = now(), stats = $1 where id = $2`,
      [JSON.stringify(full), runId],
    );
    return full;
  } catch (e) {
    await execute(
      `update analysis_run set status = 'error', finished_at = now(), error = $1 where id = $2`,
      [String(e).slice(0, 1000), runId],
    );
    throw e;
  }
}

function buildContext(records: RecordRow[]): {
  context: string;
  windowedFrom: number;
} {
  const blocks: string[] = [];
  for (const r of records) {
    const text = (r.text_content ?? "").trim();
    if (!text) continue;
    const clipped =
      text.length > PER_RECORD_CHARS ? `${text.slice(0, PER_RECORD_CHARS)}…[truncated]` : text;
    const who = r.role ?? r.record_type;
    blocks.push(`<record uuid="${r.uuid}" role="${who}">\n${clipped}\n</record>`);
  }

  // Window from the TAIL: keep the most recent blocks that fit the cap.
  let total = 0;
  const kept: string[] = [];
  let windowedFrom = 0;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    if (!block) continue;
    const len = block.length + 1;
    if (total + len > MAX_CONTEXT_CHARS && kept.length > 0) {
      windowedFrom = i + 1; // number of head blocks elided
      break;
    }
    total += len;
    kept.unshift(block);
  }
  return { context: kept.join("\n"), windowedFrom };
}

function extractionPrompt(context: string, windowedFrom: number): string {
  const note =
    windowedFrom > 0
      ? `Note: the first ${windowedFrom} records of this session were elided for length; you are seeing the most recent records.\n\n`
      : "";
  return `${note}Here is the session transcript. Each record has a uuid you must cite as evidence.\n\n${context}`;
}

async function persistClaims(args: {
  runId: string;
  projectId: string;
  sessionId: string;
  claims: ExtractedClaim[];
  valid: Set<string>;
}): Promise<{
  claimsProposed: number;
  claimsInserted: number;
  evidenceInserted: number;
  droppedEvidence: number;
}> {
  let claimsInserted = 0;
  let evidenceInserted = 0;
  let droppedEvidence = 0;

  for (const claim of args.claims) {
    // Keep only evidence pointing at records that actually exist (drop
    // hallucinated uuids). A claim with no real evidence is discarded.
    const evidence = claim.evidence.filter((e) => {
      const ok = args.valid.has(e.recordUuid);
      if (!ok) droppedEvidence += 1;
      return ok;
    });
    if (evidence.length === 0) continue;

    const fingerprint = claimFingerprint({
      projectId: args.projectId,
      claimType: claim.claimType,
      claim: claim.claim,
      evidenceUuids: evidence.map((e) => e.recordUuid),
    });
    const claimId = newId("claim");

    const inserted = await withTx(async (tx) => {
      const n = await tx.execute(
        `insert into knowledge_claim
				   (id, analysis_run_id, project_id, session_id, claim_type, claim, body, scope, fingerprint)
				 values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
				 on conflict (fingerprint) do nothing`,
        [
          claimId,
          args.runId,
          args.projectId,
          args.sessionId,
          claim.claimType,
          claim.claim,
          claim.body,
          claim.scope,
          fingerprint,
        ],
      );
      if (n === 0) return false; // already extracted in a prior run
      for (const e of evidence) {
        await tx.execute(
          `insert into knowledge_claim_evidence (id, claim_id, record_uuid, quote)
					 values ($1, $2, $3, $4)
					 on conflict (claim_id, record_uuid) do nothing`,
          [newId("evidence"), claimId, e.recordUuid, e.quote ?? null],
        );
      }
      return true;
    });

    if (inserted) {
      claimsInserted += 1;
      evidenceInserted += evidence.length;
    }
  }

  return {
    claimsProposed: args.claims.length,
    claimsInserted,
    evidenceInserted,
    droppedEvidence,
  };
}
