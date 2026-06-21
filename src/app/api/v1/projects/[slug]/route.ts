import { z } from "zod";

import { authorizeBearer, unauthorized } from "@/lib/api/auth";
import {
	freshnessBucket,
	getProjectBySlug,
	listEntries,
} from "@/lib/queries";

const paramsSchema = z.object({ slug: z.string().min(1).max(160) });

/** GET /api/v1/projects/{slug} — a project + its active Memories (claim-level). */
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

	const entries = await listEntries(project.id, { status: "active" });
	return Response.json({
		project: {
			slug: project.slug,
			name: project.displayName,
			remote: project.canonicalRemote,
		},
		memories: entries.map((e) => ({
			id: e.id,
			type: e.entryType,
			claim: e.claim,
			confidence: e.confidence,
			sessions: e.sessionCount,
			freshness: freshnessBucket(e.lastSeenAt, e.confidence),
			lastSeenAt: e.lastSeenAt,
			url: `/m/${e.id}`,
		})),
	});
}
