/**
 * Briefing reads — the hook. Latest cached per-project briefing.
 */

import "server-only";

import { maybeOne } from "@/lib/db";
import type { BriefingView } from "./types";

type BriefingRow = {
	id: string;
	content: string;
	state_of_mind: string | null;
	entry_count_at_gen: number | null;
	created_at: Date;
};

export async function latestBriefing(
	projectId: string,
): Promise<BriefingView | null> {
	const row = await maybeOne<BriefingRow>(
		`select id, content, state_of_mind, entry_count_at_gen, created_at
		 from briefing
		 where project_id = $1
		 order by created_at desc
		 limit 1`,
		[projectId],
	);
	if (!row) {
		return null;
	}
	return {
		id: row.id,
		content: row.content,
		stateOfMind: row.state_of_mind,
		entryCountAtGen: row.entry_count_at_gen,
		createdAt: row.created_at,
	};
}
