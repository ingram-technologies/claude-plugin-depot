import { authorizeBearer, unauthorized } from "@/lib/api/auth";
import { listProjects } from "@/lib/queries";

/** GET /api/v1/projects — the agent-facing project index. */
export async function GET(req: Request) {
	const auth = await authorizeBearer(req);
	if (!auth) {
		return unauthorized();
	}
	const projects = await listProjects({ organizationId: auth.organizationId });
	return Response.json({
		projects: projects.map((p) => ({
			slug: p.slug,
			name: p.displayName,
			remote: p.canonicalRemote,
			memories: p.entryCount,
			sessions: p.sessionCount,
			lastLearnedAt: p.lastLearnedAt,
		})),
	});
}
