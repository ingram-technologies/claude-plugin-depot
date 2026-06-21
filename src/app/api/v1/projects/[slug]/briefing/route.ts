import { z } from "zod";

import { authorizeBearer, unauthorized } from "@/lib/api/auth";
import {
	getEntry,
	getProjectBySlug,
	latestBriefing,
	listEntries,
} from "@/lib/queries";

const paramsSchema = z.object({ slug: z.string().min(1).max(160) });

/**
 * GET /api/v1/projects/{slug}/briefing — the hook, for agents. Returns the
 * cited brief plus the top Memories WITH provenance (record uuids + quotes), so
 * a consuming agent can verify every claim against source.
 */
export async function GET(
	req: Request,
	ctx: { params: Promise<{ slug: string }> },
) {
	const auth = await authorizeBearer(req);
	if (!auth) {
		return unauthorized();
	}
	const parsed = paramsSchema.safeParse(await ctx.params);
	if (!parsed.success) {
		return Response.json({ error: "bad slug" }, { status: 400 });
	}

	const project = await getProjectBySlug(parsed.data.slug);
	if (!project) {
		return Response.json({ error: "not found" }, { status: 404 });
	}

	const [briefing, top] = await Promise.all([
		latestBriefing(project.id),
		listEntries(project.id, { status: "active" }),
	]);

	// Hydrate provenance for the top-N (bounded) so payloads stay sane.
	const topN = top.slice(0, 12);
	const detailed = await Promise.all(topN.map((e) => getEntry(e.id)));

	return Response.json({
		project: { slug: project.slug, name: project.displayName },
		briefing: briefing
			? {
					stateOfMind: briefing.stateOfMind,
					content: briefing.content,
					generatedAt: briefing.createdAt,
				}
			: null,
		memories: detailed
			.filter((e): e is NonNullable<typeof e> => e !== null)
			.map((e) => ({
				id: e.id,
				type: e.entryType,
				claim: e.claim,
				body: e.body,
				scope: e.scope,
				confidence: e.confidence,
				sessions: e.sessionCount,
				lastSeenAt: e.lastSeenAt,
				provenance: e.evidence.map((ev) => ({
					recordUuid: ev.recordUuid,
					quote: ev.quote,
					model: ev.model,
					observedAt: ev.observedAt ?? ev.sessionDate,
				})),
			})),
	});
}
