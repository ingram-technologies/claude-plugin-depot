/**
 * Ingest bearer tokens. We store ONLY a sha256 hash of the raw token; the raw
 * value is shown exactly once (at issue time). Verification looks a token up by
 * its hash, ignores revoked tokens, and bumps `lastUsedAt`.
 */

import { createHash, randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";

const { ingestToken } = schema;

/** Resolved identity carried by a verified ingest token. */
export type IngestAuth = {
  tokenId: string;
  personId?: string;
  machineId?: string;
};

/** sha256 hex of the raw token bytes (utf-8). */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/**
 * Verify a raw bearer token. Returns the resolved identity, or null if the
 * token is unknown or revoked. Side effect: bumps `lastUsedAt` on success.
 */
export async function verifyIngestToken(rawToken: string): Promise<IngestAuth | null> {
  const trimmed = rawToken.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const tokenHash = hashToken(trimmed);
  const rows = await db
    .select({
      id: ingestToken.id,
      personId: ingestToken.personId,
      machineId: ingestToken.machineId,
      revokedAt: ingestToken.revokedAt,
    })
    .from(ingestToken)
    .where(eq(ingestToken.tokenHash, tokenHash))
    .limit(1);

  const found = rows.at(0);
  if (!found) {
    return null;
  }
  if (found.revokedAt) {
    return null;
  }

  await db.update(ingestToken).set({ lastUsedAt: new Date() }).where(eq(ingestToken.id, found.id));

  const auth: IngestAuth = { tokenId: found.id };
  if (found.personId) {
    auth.personId = found.personId;
  }
  if (found.machineId) {
    auth.machineId = found.machineId;
  }
  return auth;
}

/**
 * Issue a new ingest token. Returns the RAW token exactly once; only the hash
 * is persisted. For seeding/CLI use.
 */
export async function issueIngestToken(opts: {
  label?: string;
  personId?: string;
  machineId?: string;
}): Promise<{ id: string; token: string }> {
  // 32 random bytes → 64 hex chars, prefixed so it's recognizable in logs.
  const token = `dpt_${randomBytes(32).toString("hex")}`;
  const id = newId("ingestToken");

  await db.insert(ingestToken).values({
    id,
    tokenHash: hashToken(token),
    label: opts.label ?? null,
    personId: opts.personId ?? null,
    machineId: opts.machineId ?? null,
  });

  return { id, token };
}

/** Soft-revoke a token by id. Idempotent. */
export async function revokeIngestToken(tokenId: string): Promise<void> {
  await db.update(ingestToken).set({ revokedAt: new Date() }).where(eq(ingestToken.id, tokenId));
}
