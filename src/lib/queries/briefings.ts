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
	opts: { organizationId?: string } = {},
): Promise<BriefingView | null> {
	const params: unknown[] = [projectId];
	let orgGuard = "";
	if (opts.organizationId) {
		params.push(opts.organizationId);
		orgGuard = `and exists (
			select 1 from project p
			where p.id = b.project_id and p.organization_id = $${params.length}
		)`;
	}
	const row = await maybeOne<BriefingRow>(
		`select b.id, b.content, b.state_of_mind, b.entry_count_at_gen, b.created_at
		 from briefing b
		 where b.project_id = $1 ${orgGuard}
		 order by b.created_at desc
		 limit 1`,
		params,
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
