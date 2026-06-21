/**
 * Project reads — the spine of the app. Raw SQL via the nk-db helpers, since
 * these are aggregation-heavy joins the ORM is awkward at. Rows come back
 * snake_case with native JS types (Date / number); we map to camelCase
 * view-models in `types.ts`.
 */

import "server-only";

import { maybeOne, query } from "@/lib/db";
import type {
	ActivityDay,
	CorpusHealth,
	ProjectSummary,
} from "./types";

type ProjectRow = {
	id: string;
	slug: string;
	display_name: string;
	description: string | null;
	canonical_remote: string;
	last_activity_at: Date | null;
	entry_count: number | string;
	session_count: number | string;
	last_learned_at: Date | null;
};

function toProjectSummary(r: ProjectRow): ProjectSummary {
	return {
		id: r.id,
		slug: r.slug,
		displayName: r.display_name,
		description: r.description,
		canonicalRemote: r.canonical_remote,
		lastActivityAt: r.last_activity_at,
		entryCount: Number(r.entry_count),
		sessionCount: Number(r.session_count),
		lastLearnedAt: r.last_learned_at,
	};
}

const PROJECT_SELECT = `
	select
		p.id,
		p.slug,
		p.display_name,
		p.description,
		p.canonical_remote,
		p.last_activity_at,
		coalesce(e.entry_count, 0) as entry_count,
		coalesce(s.session_count, 0) as session_count,
		e.last_learned_at
	from project p
	left join (
		select project_id,
		       count(*) filter (where status = 'active') as entry_count,
		       max(updated_at) as last_learned_at
		from knowledge_entry
		group by project_id
	) e on e.project_id = p.id
	left join (
		select project_id, count(*) as session_count
		from session
		group by project_id
	) s on s.project_id = p.id
`;

export async function listProjects(): Promise<ProjectSummary[]> {
	const rows = await query<ProjectRow>(
		`${PROJECT_SELECT}
		 order by e.last_learned_at desc nulls last, p.last_activity_at desc nulls last`,
	);
	return rows.map(toProjectSummary);
}

export async function getProjectBySlug(
	slug: string,
): Promise<ProjectSummary | null> {
	const row = await maybeOne<ProjectRow>(
		`${PROJECT_SELECT} where p.slug = $1`,
		[slug],
	);
	return row ? toProjectSummary(row) : null;
}

/**
 * Sessions per day over the trailing window, for the activity sparkline. Days
 * with no sessions are omitted; the renderer fills the gaps.
 */
export async function projectActivity(
	projectId: string,
	days = 30,
): Promise<ActivityDay[]> {
	const rows = await query<{ day: string; count: number | string }>(
		`select to_char(date_trunc('day', coalesce(last_activity_at, started_at, created_at)), 'YYYY-MM-DD') as day,
		        count(*) as count
		 from session
		 where project_id = $1
		   and coalesce(last_activity_at, started_at, created_at) >= now() - ($2 || ' days')::interval
		 group by 1
		 order by 1`,
		[projectId, days],
	);
	return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
}

/**
 * Corpus health: active entries bucketed by the freshness heuristic, computed
 * in SQL so the three summary dots reflect the whole corpus, not a page of it.
 * Mirrors `freshness.ts` thresholds (21d/0.6 fresh, 90d/0.35 aging).
 */
export async function corpusHealth(projectId: string): Promise<CorpusHealth> {
	const row = await maybeOne<{
		fresh: number | string;
		aging: number | string;
		stale: number | string;
		total: number | string;
	}>(
		`select
			count(*) filter (
				where last_seen_at >= now() - interval '21 days' and confidence >= 0.6
			) as fresh,
			count(*) filter (
				where (last_seen_at >= now() - interval '90 days' and confidence >= 0.35)
				  and not (last_seen_at >= now() - interval '21 days' and confidence >= 0.6)
			) as aging,
			count(*) filter (
				where last_seen_at is null
				   or (last_seen_at < now() - interval '90 days' or confidence < 0.35)
			) as stale,
			count(*) as total
		 from knowledge_entry
		 where project_id = $1 and status = 'active'`,
		[projectId],
	);
	if (!row) {
		return { fresh: 0, aging: 0, stale: 0, total: 0 };
	}
	return {
		fresh: Number(row.fresh),
		aging: Number(row.aging),
		stale: Number(row.stale),
		total: Number(row.total),
	};
}
