/**
 * Orchestration: drive extract → canonicalize → brief for a project (or all).
 *
 * "Stale" = a session with new records past `analyzed_through_ts` (or never
 * analyzed). Re-extracting a non-stale session is harmless (idempotent), but
 * skipping them keeps a sweep cheap.
 */

import { query } from "@/lib/db";
import { extractSession } from "./extract";
import { canonicalizeProject } from "./canonicalize";
import { generateBriefing } from "./brief";

export type ProjectPipelineResult = {
  projectId: string;
  sessionsExtracted: string[];
  extractErrors: { sessionId: string; error: string }[];
  canonicalize: Awaited<ReturnType<typeof canonicalizeProject>>;
  brief: Awaited<ReturnType<typeof generateBriefing>>;
};

/** Sessions for a project with records not yet analyzed. */
export async function staleSessionsForProject(projectId: string): Promise<string[]> {
  const rows = await query<{ id: string }>(
    `select s.id
		 from session s
		 where s.project_id = $1
		   and exists (
		     select 1 from transcript_record r
		     where r.session_id = s.id
		       and r.is_sidechain = false
		       and (s.analyzed_through_ts is null or r.ts > s.analyzed_through_ts)
		   )
		 order by s.last_activity_at desc nulls last`,
    [projectId],
  );
  return rows.map((r) => r.id);
}

export async function runProjectPipeline(projectId: string): Promise<ProjectPipelineResult> {
  const stale = await staleSessionsForProject(projectId);
  const sessionsExtracted: string[] = [];
  const extractErrors: { sessionId: string; error: string }[] = [];

  for (const sessionId of stale) {
    try {
      await extractSession(sessionId);
      sessionsExtracted.push(sessionId);
    } catch (e) {
      extractErrors.push({ sessionId, error: String(e).slice(0, 500) });
    }
  }

  const canonicalize = await canonicalizeProject(projectId);
  const brief = await generateBriefing(projectId);

  return { projectId, sessionsExtracted, extractErrors, canonicalize, brief };
}

/** Run the pipeline for every project that has at least one stale session. */
export async function runAllStaleProjects(): Promise<ProjectPipelineResult[]> {
  const projects = await query<{ id: string }>(
    `select distinct s.project_id as id
		 from session s
		 where s.project_id is not null
		   and exists (
		     select 1 from transcript_record r
		     where r.session_id = s.id
		       and r.is_sidechain = false
		       and (s.analyzed_through_ts is null or r.ts > s.analyzed_through_ts)
		   )`,
  );
  const results: ProjectPipelineResult[] = [];
  for (const p of projects) {
    results.push(await runProjectPipeline(p.id));
  }
  return results;
}
