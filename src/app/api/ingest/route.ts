/**
 * POST /api/ingest — the plugin's upload endpoint.
 *
 * Auth: `Authorization: Bearer <ingest token>`. Body: the ingest wire contract
 * (Zod-validated). Returns counts of accepted/duplicate files and
 * inserted/deduped records, plus touched sessions. Idempotent end to end.
 */

import { z } from "zod";

import { ingestUpload } from "@/lib/ingest/ingest";
import { verifyIngestToken } from "@/lib/ingest/tokens";
import { ingestPayloadSchema } from "@/lib/ingest/validation";

export const runtime = "nodejs";

// Guard against pathological payloads (the plugin batches new-since-cursor
// records; legitimate uploads are well under this).
const MAX_BYTES = 32 * 1024 * 1024; // 32 MiB

function bearer(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1];
  return token ? token.trim() : null;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request): Promise<Response> {
  const rawToken = bearer(req);
  if (!rawToken) {
    return json({ ok: false, error: "missing bearer token" }, 401);
  }

  const auth = await verifyIngestToken(rawToken);
  if (!auth) {
    return json({ ok: false, error: "invalid or revoked token" }, 401);
  }

  // Size guard before parsing JSON.
  const lengthHeader = req.headers.get("content-length");
  if (lengthHeader) {
    const declared = Number.parseInt(lengthHeader, 10);
    if (Number.isFinite(declared) && declared > MAX_BYTES) {
      return json({ ok: false, error: "payload too large" }, 413);
    }
  }

  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    return json({ ok: false, error: "unreadable body" }, 400);
  }
  if (bodyText.length > MAX_BYTES) {
    return json({ ok: false, error: "payload too large" }, 413);
  }

  let bodyJson: unknown;
  try {
    bodyJson = JSON.parse(bodyText);
  } catch {
    return json({ ok: false, error: "invalid JSON" }, 400);
  }

  const parsed = ingestPayloadSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return json(
      {
        ok: false,
        error: "invalid body",
        issues: z.treeifyError(parsed.error),
      },
      400,
    );
  }

  try {
    const result = await ingestUpload(parsed.data, auth);
    return json(result, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingest failed";
    return json({ ok: false, error: message }, 500);
  }
}
