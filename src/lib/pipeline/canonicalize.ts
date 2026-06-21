/**
 * Stage 3 — Canonicalize (separate, mostly-deterministic merge).
 *
 * Clusters un-clustered `knowledge_claim`s into curated `knowledge_entry`s. For
 * each claim we retrieve candidate entries by trigram similarity (same project +
 * type), let the CANONICALIZER agent CHOOSE merge / new / supersede, then APPLY
 * the decision deterministically in app code. The LLM never writes an entry's
 * identity — it only picks among ids we gave it (or asks for a new one).
 *
 * After each touched entry we roll up provenance and recompute derived fields
 * (sessionCount / firstSeenAt / lastSeenAt / confidence) from evidence.
 */

import { newId } from "@/lib/ids";
import { execute, maybeOne, one, query } from "@/lib/db";
import { runStructured } from "@/lib/agent/client";
import { CANONICALIZER_AGENT } from "@/lib/agent/specs";
import { CanonicalDecision, type CanonicalContentT } from "./schemas";
import { computeConfidence } from "./confidence";

const CANDIDATE_LIMIT = 6;

type ClaimRow = {
  id: string;
  claim_type: string;
  claim: string;
  body: string | null;
  scope: string | null;
};

type CandidateRow = {
  id: string;
  title: string;
  claim: string;
  body: string | null;
};

export type CanonicalizeStats = {
  projectId: string;
  claimsProcessed: number;
  created: number;
  merged: number;
  superseded: number;
  entriesTouched: number;
};

export async function canonicalizeProject(projectId: string): Promise<CanonicalizeStats> {
  const runId = newId("analysisRun");
  await execute(
    `insert into analysis_run (id, kind, status, project_id, agent_id, model)
		 values ($1, 'canonicalize', 'running', $2, $3, $4)`,
    [runId, projectId, process.env.DEPOT_CANONICALIZER_AGENT_ID ?? null, CANONICALIZER_AGENT.model],
  );

  const stats: CanonicalizeStats = {
    projectId,
    claimsProcessed: 0,
    created: 0,
    merged: 0,
    superseded: 0,
    entriesTouched: 0,
  };
  const touched = new Set<string>();

  try {
    // Un-clustered claims, oldest first so earlier claims seed entries that
    // later ones can merge into.
    const claims = await query<ClaimRow>(
      `select id, claim_type, claim, body, scope
			 from knowledge_claim
			 where project_id = $1 and canonical_id is null
			 order by created_at asc`,
      [projectId],
    );

    for (const claim of claims) {
      stats.claimsProcessed += 1;
      const candidates = await fetchCandidates(projectId, claim);
      const decision = await decide(claim, candidates);

      const entryId = await applyDecision({
        projectId,
        claim,
        decision: decision.decision,
        targetEntryId: pickValidTarget(decision.targetEntryId, candidates),
        content: decision.content,
        stats,
      });

      touched.add(entryId);
      await rollUpEvidence(entryId, claim.id);
      await recomputeEntry(entryId);
    }

    stats.entriesTouched = touched.size;
    await execute(
      `update analysis_run set status = 'done', finished_at = now(), stats = $1 where id = $2`,
      [JSON.stringify(stats), runId],
    );
    return stats;
  } catch (e) {
    await execute(
      `update analysis_run set status = 'error', finished_at = now(), error = $1 where id = $2`,
      [String(e).slice(0, 1000), runId],
    );
    throw e;
  }
}

/** Only honor a target id the model was actually offered — never invented. */
function pickValidTarget(target: string | null, candidates: CandidateRow[]): string | null {
  if (!target) return null;
  return candidates.some((c) => c.id === target) ? target : null;
}

/**
 * Trigram candidate retrieval over active entries of the same project + type.
 * Uses pg_trgm `similarity()`; if the extension isn't available, falls back to a
 * simple ILIKE token match so the pipeline still runs (lower recall).
 */
async function fetchCandidates(projectId: string, claim: ClaimRow): Promise<CandidateRow[]> {
  try {
    return await query<CandidateRow>(
      `select id, title, claim, body
			 from knowledge_entry
			 where project_id = $1 and entry_type = $2 and status = 'active'
			 order by greatest(similarity(claim, $3), similarity(title, $3)) desc
			 limit $4`,
      [projectId, claim.claim_type, claim.claim, CANDIDATE_LIMIT],
    );
  } catch {
    // pg_trgm not installed → degrade gracefully.
    const term = `%${claim.claim.split(/\s+/).slice(0, 3).join("%")}%`;
    return await query<CandidateRow>(
      `select id, title, claim, body
			 from knowledge_entry
			 where project_id = $1 and entry_type = $2 and status = 'active'
			   and (claim ilike $3 or title ilike $3)
			 order by updated_at desc
			 limit $4`,
      [projectId, claim.claim_type, term, CANDIDATE_LIMIT],
    );
  }
}

async function decide(
  claim: ClaimRow,
  candidates: CandidateRow[],
): Promise<{
  decision: "new" | "merge" | "supersede";
  targetEntryId: string | null;
  content: CanonicalContentT;
}> {
  // No candidates → it can only be new; skip the LLM call.
  if (candidates.length === 0) {
    return {
      decision: "new",
      targetEntryId: null,
      content: {
        title: titleFrom(claim.claim),
        claim: claim.claim,
        body: claim.body ?? "",
        scope: claim.scope ?? "",
      },
    };
  }

  const prompt = canonicalizePrompt(claim, candidates);
  const result = await runStructured({
    agent: CANONICALIZER_AGENT,
    schema: CanonicalDecision,
    prompt,
  });

  // Fill any omitted content from the claim itself (provenance/content must
  // never be empty), and clamp to the canonical lengths.
  const content: CanonicalContentT = {
    title: (result.content?.title || titleFrom(claim.claim)).slice(0, 120),
    claim: (result.content?.claim || claim.claim).slice(0, 400),
    body: (result.content?.body ?? claim.body ?? "").slice(0, 2_000),
    scope: (result.content?.scope ?? claim.scope ?? "").slice(0, 200),
  };

  // A merge/supersede must name a real candidate; otherwise treat it as new.
  const targetEntryId = result.targetEntryId ?? null;
  const validTarget =
    targetEntryId !== null && candidates.some((c) => c.id === targetEntryId);
  const decision =
    result.decision !== "new" && validTarget ? result.decision : "new";

  return { decision, targetEntryId: validTarget ? targetEntryId : null, content };
}

function canonicalizePrompt(claim: ClaimRow, candidates: CandidateRow[]): string {
  const newClaim = JSON.stringify(
    {
      claimType: claim.claim_type,
      claim: claim.claim,
      body: claim.body ?? "",
      scope: claim.scope ?? "",
    },
    null,
    2,
  );
  const cand = candidates
    .map(
      (c, i) =>
        `${i + 1}. id=${c.id}\n   title: ${c.title}\n   claim: ${c.claim}\n   body: ${c.body ?? ""}`,
    )
    .join("\n");
  return `NEW CLAIM:\n${newClaim}\n\nCANDIDATE EXISTING ENTRIES (same project + type):\n${cand}\n\nChoose merge / supersede / new. targetEntryId must be one of the candidate ids above, or null for "new".`;
}

async function applyDecision(args: {
  projectId: string;
  claim: ClaimRow;
  decision: "new" | "merge" | "supersede";
  targetEntryId: string | null;
  content: CanonicalContentT;
  stats: CanonicalizeStats;
}): Promise<string> {
  const { projectId, claim, content, stats } = args;

  if (args.decision === "merge" && args.targetEntryId) {
    await execute(`update knowledge_claim set canonical_id = $1 where id = $2`, [
      args.targetEntryId,
      claim.id,
    ]);
    // Adopt the (possibly sharpened) canonical content the model returned.
    await execute(
      `update knowledge_entry
			 set title = $1, claim = $2, body = $3, scope = $4, updated_at = now()
			 where id = $5`,
      [content.title, content.claim, content.body, content.scope, args.targetEntryId],
    );
    stats.merged += 1;
    return args.targetEntryId;
  }

  // new + supersede both create a fresh entry.
  const entryId = await createEntry(projectId, claim.claim_type, content);
  await execute(`update knowledge_claim set canonical_id = $1 where id = $2`, [entryId, claim.id]);

  if (args.decision === "supersede" && args.targetEntryId) {
    await execute(
      `update knowledge_entry
			 set status = 'superseded', superseded_by_id = $1, superseded_at = now(), updated_at = now()
			 where id = $2`,
      [entryId, args.targetEntryId],
    );
    stats.superseded += 1;
  } else {
    stats.created += 1;
  }
  return entryId;
}

async function createEntry(
  projectId: string,
  entryType: string,
  content: CanonicalContentT,
): Promise<string> {
  const entryId = newId("entry");
  const slug = await uniqueSlug(projectId, content.title);
  await execute(
    `insert into knowledge_entry
		   (id, project_id, entry_type, slug, title, claim, body, scope, status)
		 values ($1, $2, $3, $4, $5, $6, $7, $8, 'active')`,
    [
      entryId,
      projectId,
      entryType,
      slug,
      content.title,
      content.claim,
      content.body,
      content.scope,
    ],
  );
  return entryId;
}

/** Copy a claim's evidence into the entry's rolled-up provenance. */
async function rollUpEvidence(entryId: string, claimId: string): Promise<void> {
  const evidence = await query<{
    record_uuid: string;
    quote: string | null;
    session_id: string | null;
    observed_at: Date | null;
  }>(
    `select e.record_uuid, e.quote, c.session_id, r.ts as observed_at
		 from knowledge_claim_evidence e
		 join knowledge_claim c on c.id = e.claim_id
		 join transcript_record r on r.uuid = e.record_uuid
		 where e.claim_id = $1`,
    [claimId],
  );
  for (const ev of evidence) {
    await execute(
      `insert into knowledge_entry_evidence
			   (id, entry_id, record_uuid, via_claim_id, session_id, quote, observed_at)
			 values ($1, $2, $3, $4, $5, $6, $7)
			 on conflict (entry_id, record_uuid) do nothing`,
      [
        newId("evidence"),
        entryId,
        ev.record_uuid,
        claimId,
        ev.session_id,
        ev.quote,
        ev.observed_at,
      ],
    );
  }
}

/** Recompute derived fields on an entry from its evidence. */
async function recomputeEntry(entryId: string): Promise<void> {
  const agg = await one<{
    session_count: number;
    first_seen: Date | null;
    last_seen: Date | null;
  }>(
    `select count(distinct session_id)::int as session_count,
		        min(observed_at) as first_seen,
		        max(observed_at) as last_seen
		 from knowledge_entry_evidence
		 where entry_id = $1`,
    [entryId],
  );
  const confidence = computeConfidence({
    sessionCount: agg.session_count,
    lastSeenAt: agg.last_seen,
  });
  await execute(
    `update knowledge_entry
		 set session_count = $1, first_seen_at = $2, last_seen_at = $3,
		     confidence = $4, updated_at = now()
		 where id = $5`,
    [agg.session_count, agg.first_seen, agg.last_seen, confidence, entryId],
  );
}

function titleFrom(claim: string): string {
  const t = claim.trim().replace(/\.$/, "");
  return t.length > 120 ? `${t.slice(0, 117)}…` : t;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "entry"
  );
}

/** Slug unique within (project, slug). Suffix on collision. */
async function uniqueSlug(projectId: string, title: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  for (let i = 2; i < 1000; i++) {
    const clash = await maybeOne<{ id: string }>(
      `select id from knowledge_entry where project_id = $1 and slug = $2`,
      [projectId, slug],
    );
    if (!clash) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${newId("entry").slice(-6)}`;
}
