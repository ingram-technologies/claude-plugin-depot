/**
 * Identity resolution: machine + account upserts. Both are idempotent — the
 * SAME payload resolves to the SAME row every time. Upserts key off the natural
 * unique indexes (`machine.fingerprint`, `account(vendor, vendorAccountId)`).
 */

import { and, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";

import type { Tx } from "./tx";

const { machine, account } = schema;

export type MachineInput = {
  fingerprint: string;
  hostname?: string;
  os?: string;
};

export type AccountInput = {
  vendor: string;
  vendorAccountId: string;
  email?: string;
};

/**
 * Upsert a machine by fingerprint. Refreshes hostname/os/lastSeenAt and (if not
 * already owned) associates the uploader's person.
 */
export async function resolveMachine(
  input: MachineInput,
  personId: string | undefined,
  conn: Tx = db,
): Promise<{ id: string }> {
  const id = newId("machine");
  const set: Record<string, unknown> = { lastSeenAt: new Date() };
  if (input.hostname !== undefined) {
    set.hostname = input.hostname;
  }
  if (input.os !== undefined) {
    set.os = input.os;
  }

  await conn
    .insert(machine)
    .values({
      id,
      fingerprint: input.fingerprint,
      hostname: input.hostname ?? null,
      os: input.os ?? null,
      personId: personId ?? null,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({ target: machine.fingerprint, set });

  const rows = await conn
    .select({ id: machine.id, personId: machine.personId })
    .from(machine)
    .where(eq(machine.fingerprint, input.fingerprint))
    .limit(1);
  const found = rows.at(0);
  if (!found) {
    throw new Error("resolveMachine: upsert produced no row");
  }

  // Claim ownership lazily without clobbering an existing owner.
  if (personId && !found.personId) {
    await conn.update(machine).set({ personId }).where(eq(machine.id, found.id));
  }

  return { id: found.id };
}

/** Upsert an AI account by (vendor, vendorAccountId). */
export async function resolveAccount(input: AccountInput, conn: Tx = db): Promise<{ id: string }> {
  const id = newId("account");
  const set: Record<string, unknown> = {};
  if (input.email !== undefined) {
    set.email = input.email;
  }

  await conn
    .insert(account)
    .values({
      id,
      vendor: input.vendor,
      vendorAccountId: input.vendorAccountId,
      email: input.email ?? null,
    })
    .onConflictDoUpdate({
      target: [account.vendor, account.vendorAccountId],
      set: Object.keys(set).length > 0 ? set : { vendor: input.vendor },
    });

  const rows = await conn
    .select({ id: account.id })
    .from(account)
    .where(
      and(eq(account.vendor, input.vendor), eq(account.vendorAccountId, input.vendorAccountId)),
    )
    .limit(1);
  const found = rows.at(0);
  if (!found) {
    throw new Error("resolveAccount: upsert produced no row");
  }
  return { id: found.id };
}
