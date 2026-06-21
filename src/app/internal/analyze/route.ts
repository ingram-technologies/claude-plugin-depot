/**
 * POST /internal/analyze — drive the insights pipeline.
 *
 * Worker/cron plumbing (not a public API): gated by a shared worker secret, not a
 * user session. Runs extract → canonicalize → brief for one project, or sweeps
 * every project with stale sessions.
 *
 * Auth: `Authorization: Bearer <WORKER_SECRET>` (falls back to
 * `INGEST_TOKEN_SECRET` if WORKER_SECRET is unset).
 * Body (optional): `{ "projectId": "prj_…" }` — omit to sweep all stale projects.
 */

import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { runAllStaleProjects, runProjectPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 800;

const bodySchema = z.object({ projectId: z.string().min(1).optional() }).strict();

function workerSecret(): string | null {
  return process.env.WORKER_SECRET || process.env.INGEST_TOKEN_SECRET || null;
}

function bearer(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1];
  return token ? token.trim() : null;
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request): Promise<Response> {
  const secret = workerSecret();
  if (!secret) return json({ error: "worker secret not configured" }, 500);

  const token = bearer(req);
  if (!token || !constantTimeEqual(token, secret)) return json({ error: "unauthorized" }, 401);

  let parsed: z.infer<typeof bodySchema>;
  try {
    const raw = await req.json().catch(() => ({}));
    parsed = bodySchema.parse(raw ?? {});
  } catch (e) {
    return json({ error: "invalid body", detail: String(e).slice(0, 300) }, 400);
  }

  try {
    if (parsed.projectId) {
      const result = await runProjectPipeline(parsed.projectId);
      return json({ ok: true, projects: [result] }, 200);
    }
    const results = await runAllStaleProjects();
    return json({ ok: true, projects: results }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 500) }, 500);
  }
}
