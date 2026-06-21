/**
 * Memory (knowledge_entry) reads: typed lists, the feed across projects, and a
 * single entry with its rolled-up provenance.
 */

import "server-only";

import { maybeOne, query } from "@/lib/db";
import type {
	EntryDetail,
	EntryStatus,
	EntrySummary,
	EntryType,
	EvidenceRow,
	RelatedEntry,
} from "./types";

const ENTRY_TYPES: readonly EntryType[] = [
	"decision",
	"gotcha",
	"principle",
	"state",
];
const ENTRY_STATUSES: readonly EntryStatus[] = [
	"active",
	"superseded",
	"contested",
	"retired",
];

function asEntryType(v: string): EntryType {
	for (const t of ENTRY_TYPES) {
		if (t === v) {
			return t;
		}
	}
	return "state";
}
function asEntryStatus(v: string): EntryStatus {
	for (const s of ENTRY_STATUSES) {
		if (s === v) {
			return s;
		}
	}
	return "active";
}

type SummaryRow = {
	id: string;
	project_id: string;
	project_slug: string;
	entry_type: string;
	title: string;
	claim: string;
	confidence: number;
	session_count: number;
	status: string;
	first_seen_at: Date | null;
	last_seen_at: Date | null;
	updated_at: Date;
};

function toSummary(r: SummaryRow): EntrySummary {
	return {
		id: r.id,
		projectId: r.project_id,
		projectSlug: r.project_slug,
		entryType: asEntryType(r.entry_type),
		title: r.title,
		claim: r.claim,
		confidence: Number(r.confidence),
		sessionCount: Number(r.session_count),
		status: asEntryStatus(r.status),
		firstSeenAt: r.first_seen_at,
		lastSeenAt: r.last_seen_at,
		updatedAt: r.updated_at,
	};
}

const SUMMARY_SELECT = `
	select e.id, e.project_id, p.slug as project_slug, e.entry_type, e.title,
	       e.claim, e.confidence, e.session_count, e.status,
	       e.first_seen_at, e.last_seen_at, e.updated_at
	from knowledge_entry e
	join project p on p.id = e.project_id
`;

export async function listEntries(
	projectId: string,
	opts: { type?: EntryType; status?: EntryStatus } = {},
): Promise<EntrySummary[]> {
	const conds = ["e.project_id = $1"];
	const params: unknown[] = [projectId];
	if (opts.type) {
		params.push(opts.type);
		conds.push(`e.entry_type = $${params.length}`);
	}
	params.push(opts.status ?? "active");
	conds.push(`e.status = $${params.length}`);

	const rows = await query<SummaryRow>(
		`${SUMMARY_SELECT}
		 where ${conds.join(" and ")}
		 order by e.confidence desc, e.session_count desc, e.last_seen_at desc nulls last`,
		params,
	);
	return rows.map(toSummary);
}

/**
 * Recently-learned entries for a project's right rail (live edge first).
 */
export async function recentlyLearned(
	projectId: string,
	limit = 8,
): Promise<EntrySummary[]> {
	const rows = await query<SummaryRow>(
		`${SUMMARY_SELECT}
		 where e.project_id = $1 and e.status = 'active'
		 order by e.updated_at desc
		 limit $2`,
		[projectId, limit],
	);
	return rows.map(toSummary);
}

/**
 * The Feed: materially-changed active entries across every project the viewer
 * can see, reverse-chronological by updated_at. (Auth scoping is a TODO once
 * project membership exists; today every signed-in employee sees all.)
 */
export async function feed(opts: { limit?: number } = {}): Promise<EntrySummary[]> {
	const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
	const rows = await query<SummaryRow>(
		`${SUMMARY_SELECT}
		 where e.status = 'active'
		 order by e.updated_at desc
		 limit $1`,
		[limit],
	);
	return rows.map(toSummary);
}

/**
 * Full-text-ish search over active Memories (claim/title/body/scope). Uses a
 * simple ILIKE for now — swap for the Postgres FTS / trigram index that the
 * pipeline already relies on once a tsvector column lands.
 */
export async function searchEntries(
	q: string,
	limit = 40,
): Promise<EntrySummary[]> {
	const needle = q.trim();
	if (needle.length === 0) {
		return [];
	}
	const like = `%${needle}%`;
	const rows = await query<SummaryRow>(
		`${SUMMARY_SELECT}
		 where e.status = 'active'
		   and (e.claim ilike $1 or e.title ilike $1 or e.body ilike $1
		        or e.scope ilike $1 or p.slug ilike $1)
		 order by e.confidence desc, e.last_seen_at desc nulls last
		 limit $2`,
		[like, Math.min(Math.max(limit, 1), 100)],
	);
	return rows.map(toSummary);
}

// ── single entry + provenance ────────────────────────────────────────────────

type DetailRow = {
	id: string;
	project_id: string;
	project_slug: string;
	project_name: string;
	entry_type: string;
	slug: string;
	title: string;
	claim: string;
	body: string | null;
	scope: string | null;
	status: string;
	confidence: number;
	session_count: number;
	tags: unknown;
	first_seen_at: Date | null;
	last_seen_at: Date | null;
	last_confirmed_at: Date | null;
	updated_at: Date;
	superseded_by_id: string | null;
};

type EvidenceQueryRow = {
	id: string;
	record_uuid: string;
	quote: string | null;
	observed_at: Date | null;
	session_id: string | null;
	session_date: Date | null;
	model: string | null;
	text_content: string | null;
};

type RelatedRow = {
	id: string;
	entry_type: string;
	title: string;
	claim: string;
};

function toRelated(r: RelatedRow): RelatedEntry {
	return {
		id: r.id,
		entryType: asEntryType(r.entry_type),
		title: r.title,
		claim: r.claim,
	};
}

export async function getEntry(id: string): Promise<EntryDetail | null> {
	const row = await maybeOne<DetailRow>(
		`select e.id, e.project_id, p.slug as project_slug, p.display_name as project_name,
		        e.entry_type, e.slug, e.title, e.claim, e.body, e.scope, e.status,
		        e.confidence, e.session_count, e.tags,
		        e.first_seen_at, e.last_seen_at, e.last_confirmed_at, e.updated_at,
		        e.superseded_by_id
		 from knowledge_entry e
		 join project p on p.id = e.project_id
		 where e.id = $1`,
		[id],
	);
	if (!row) {
		return null;
	}

	const evidenceRows = await query<EvidenceQueryRow>(
		`select ev.id, ev.record_uuid, ev.quote, ev.observed_at,
		        ev.session_id,
		        coalesce(s.started_at, s.last_activity_at, tr.ts) as session_date,
		        tr.model, tr.text_content
		 from knowledge_entry_evidence ev
		 left join transcript_record tr on tr.uuid = ev.record_uuid
		 left join session s on s.id = ev.session_id
		 where ev.entry_id = $1
		 order by coalesce(ev.observed_at, tr.ts) desc nulls last`,
		[id],
	);
	const evidence: EvidenceRow[] = evidenceRows.map((r) => ({
		id: r.id,
		recordUuid: r.record_uuid,
		quote: r.quote,
		observedAt: r.observed_at,
		sessionId: r.session_id,
		sessionDate: r.session_date,
		model: r.model,
		textContent: r.text_content,
	}));

	let supersededBy: RelatedEntry | null = null;
	if (row.superseded_by_id) {
		const sup = await maybeOne<RelatedRow>(
			`select id, entry_type, title, claim from knowledge_entry where id = $1`,
			[row.superseded_by_id],
		);
		supersededBy = sup ? toRelated(sup) : null;
	}

	const supersedesRows = await query<RelatedRow>(
		`select id, entry_type, title, claim from knowledge_entry
		 where superseded_by_id = $1`,
		[id],
	);

	// "related" = same project + type, excluding self and supersession links.
	const relatedRows = await query<RelatedRow>(
		`select id, entry_type, title, claim from knowledge_entry
		 where project_id = $1 and entry_type = $2 and id <> $3
		   and status = 'active'
		   and (superseded_by_id is null or superseded_by_id <> $3)
		 order by confidence desc
		 limit 4`,
		[row.project_id, row.entry_type, id],
	);

	const tags = Array.isArray(row.tags)
		? row.tags.filter((t): t is string => typeof t === "string")
		: [];

	return {
		id: row.id,
		projectId: row.project_id,
		projectSlug: row.project_slug,
		projectName: row.project_name,
		entryType: asEntryType(row.entry_type),
		slug: row.slug,
		title: row.title,
		claim: row.claim,
		body: row.body,
		scope: row.scope,
		status: asEntryStatus(row.status),
		confidence: Number(row.confidence),
		sessionCount: Number(row.session_count),
		tags,
		firstSeenAt: row.first_seen_at,
		lastSeenAt: row.last_seen_at,
		lastConfirmedAt: row.last_confirmed_at,
		updatedAt: row.updated_at,
		supersededById: row.superseded_by_id,
		evidence,
		supersededBy,
		supersedes: supersedesRows.map(toRelated),
		related: relatedRows.map(toRelated),
	};
}
