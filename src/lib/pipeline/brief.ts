/**
 * The hook — a cited per-project briefing. Loads the top active entries, asks the
 * BRIEFER agent for ranked, cited Markdown + a one-sentence "state of mind", and
 * caches a `briefing` row.
 */

import { newId } from "@/lib/ids";
import { execute, one, query } from "@/lib/db";
import { runStructured } from "@/lib/agent/client";
import { BRIEFER_AGENT } from "@/lib/agent/specs";
import { BriefingResult } from "./schemas";

const TOP_N = 30;

type EntryRow = {
	id: string;
	entry_type: string;
	title: string;
	claim: string;
	body: string | null;
	scope: string | null;
	confidence: number;
	session_count: number;
	first_seen_at: Date | null;
	last_seen_at: Date | null;
};

export type BriefStats = {
	projectId: string;
	briefingId: string | null;
	entryCount: number;
};

export async function generateBriefing(projectId: string): Promise<BriefStats> {
	const runId = newId("analysisRun");
	await execute(
		`insert into analysis_run (id, kind, status, project_id, agent_id, model)
		 values ($1, 'brief', 'running', $2, $3, $4)`,
		[
			runId,
			projectId,
			process.env.DEPOT_BRIEFER_AGENT_ID ?? null,
			BRIEFER_AGENT.model,
		],
	);

	try {
		const entries = await query<EntryRow>(
			`select id, entry_type, title, claim, body, scope, confidence,
			        session_count, first_seen_at, last_seen_at
			 from knowledge_entry
			 where project_id = $1 and status = 'active'
			 order by confidence desc, session_count desc, last_seen_at desc nulls last
			 limit $2`,
			[projectId, TOP_N],
		);

		if (entries.length === 0) {
			await execute(
				`update analysis_run set status = 'done', finished_at = now(), stats = $1 where id = $2`,
				[
					JSON.stringify({ projectId, entryCount: 0, skipped: "no entries" }),
					runId,
				],
			);
			return { projectId, briefingId: null, entryCount: 0 };
		}

		const project = await one<{ display_name: string; slug: string }>(
			`select display_name, slug from project where id = $1`,
			[projectId],
		);

		const result = await runStructured({
			agent: BRIEFER_AGENT,
			schema: BriefingResult,
			prompt: briefPrompt(project.display_name, entries),
		});

		const briefingId = newId("briefing");
		await execute(
			`insert into briefing
			   (id, project_id, content, state_of_mind, generated_by_run_id, entry_count_at_gen)
			 values ($1, $2, $3, $4, $5, $6)`,
			[
				briefingId,
				projectId,
				result.content,
				result.stateOfMind,
				runId,
				entries.length,
			],
		);

		await execute(
			`update analysis_run set status = 'done', finished_at = now(), stats = $1 where id = $2`,
			[
				JSON.stringify({ projectId, entryCount: entries.length, briefingId }),
				runId,
			],
		);
		return { projectId, briefingId, entryCount: entries.length };
	} catch (e) {
		await execute(
			`update analysis_run set status = 'error', finished_at = now(), error = $1 where id = $2`,
			[String(e).slice(0, 1000), runId],
		);
		throw e;
	}
}

function briefPrompt(projectName: string, entries: EntryRow[]): string {
	const lines = entries.map((e) =>
		JSON.stringify({
			id: e.id,
			type: e.entry_type,
			title: e.title,
			claim: e.claim,
			body: e.body ?? "",
			scope: e.scope ?? "",
			confidence: Number(e.confidence.toFixed(2)),
			sessions: e.session_count,
			firstSeen: e.first_seen_at?.toISOString() ?? null,
			lastSeen: e.last_seen_at?.toISOString() ?? null,
		}),
	);
	return `Project: ${projectName}\n\nTop active entries (ranked; cite by id):\n${lines.join("\n")}`;
}
