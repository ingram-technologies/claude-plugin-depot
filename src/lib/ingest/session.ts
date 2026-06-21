/**
 * Session resolution + fork detection + stats.
 *
 * A `session` is keyed by (providerSessionId, machineId): a resumed/forked CLI
 * session keeps the same providerSessionId on a machine and is the SAME row.
 * Fork detection links a session to its parent when this session's root record
 * has a `parentUuid` already present in the DB under a DIFFERENT session.
 */

import { and, asc, eq, inArray, max, min, ne, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";

import { findForkPoint, type ForkCandidate } from "./fork";
import type { Tx } from "./tx";

const { session, transcriptRecord } = schema;

export type ResolveSessionInput = {
	providerSessionId: string;
	machineId: string;
	accountId?: string;
	projectId?: string;
	/** Owning tenant + producer, from the upload's ingest token. */
	organizationId?: string;
	personId?: string;
	cwd?: string;
	gitBranch?: string;
	clientVersion?: string;
};

/** Upsert a session by (providerSessionId, machineId). Idempotent. */
export async function resolveSession(
	input: ResolveSessionInput,
	conn: Tx = db,
): Promise<{ id: string }> {
	const existing = await conn
		.select({ id: session.id })
		.from(session)
		.where(
			and(
				eq(session.providerSessionId, input.providerSessionId),
				eq(session.machineId, input.machineId),
			),
		)
		.limit(1);

	const found = existing.at(0);
	if (found) {
		// Refresh the cheap denormalized context fields if newly known.
		const set: Record<string, unknown> = {};
		if (input.accountId !== undefined) {
			set.accountId = input.accountId;
		}
		if (input.projectId !== undefined) {
			set.projectId = input.projectId;
		}
		if (input.organizationId !== undefined) {
			set.organizationId = input.organizationId;
		}
		if (input.personId !== undefined) {
			set.personId = input.personId;
		}
		if (input.cwd !== undefined) {
			set.cwd = input.cwd;
		}
		if (input.gitBranch !== undefined) {
			set.gitBranch = input.gitBranch;
		}
		if (input.clientVersion !== undefined) {
			set.clientVersion = input.clientVersion;
		}
		if (Object.keys(set).length > 0) {
			await conn.update(session).set(set).where(eq(session.id, found.id));
		}
		return { id: found.id };
	}

	const id = newId("session");
	await conn
		.insert(session)
		.values({
			id,
			providerSessionId: input.providerSessionId,
			machineId: input.machineId,
			accountId: input.accountId ?? null,
			projectId: input.projectId ?? null,
			organizationId: input.organizationId ?? null,
			personId: input.personId ?? null,
			cwd: input.cwd ?? null,
			gitBranch: input.gitBranch ?? null,
			clientVersion: input.clientVersion ?? null,
		})
		.onConflictDoNothing({
			target: [session.providerSessionId, session.machineId],
		});

	const reread = await conn
		.select({ id: session.id })
		.from(session)
		.where(
			and(
				eq(session.providerSessionId, input.providerSessionId),
				eq(session.machineId, input.machineId),
			),
		)
		.limit(1);
	const resolved = reread.at(0);
	if (!resolved) {
		throw new Error("resolveSession: upsert produced no row");
	}
	return { id: resolved.id };
}

/**
 * Fork detection. The root record of this session is the one whose parentUuid
 * is null OR points outside this session. If that parentUuid resolves to a
 * record owned by a DIFFERENT session, record the fork link. Idempotent: only
 * writes when not already set.
 */
export async function detectFork(sessionId: string, conn: Tx = db): Promise<void> {
	const current = await conn
		.select({
			forkedFromSessionId: session.forkedFromSessionId,
		})
		.from(session)
		.where(eq(session.id, sessionId))
		.limit(1);
	const cur = current.at(0);
	if (!cur) {
		return;
	}
	if (cur.forkedFromSessionId) {
		return; // already linked
	}

	// The session's own record uuids — to know which parents point "outside".
	const own = await conn
		.select({ uuid: transcriptRecord.uuid })
		.from(transcriptRecord)
		.where(eq(transcriptRecord.sessionId, sessionId));
	const ownUuids = new Set<string>();
	for (const r of own) {
		ownUuids.add(r.uuid);
	}
	if (ownUuids.size === 0) {
		return;
	}

	// Candidate fork points: records in this session, in seq order so the
	// earliest external-parent edge wins.
	const rows = await conn
		.select({
			uuid: transcriptRecord.uuid,
			parentUuid: transcriptRecord.parentUuid,
		})
		.from(transcriptRecord)
		.where(eq(transcriptRecord.sessionId, sessionId))
		.orderBy(asc(transcriptRecord.seq));
	const candidates: ForkCandidate[] = rows.map((r) => ({
		uuid: r.uuid,
		parentUuid: r.parentUuid,
	}));

	// Collect external parents and resolve, in one query, which belong to a
	// different session.
	const externalParents = new Set<string>();
	for (const c of candidates) {
		if (c.parentUuid && !ownUuids.has(c.parentUuid)) {
			externalParents.add(c.parentUuid);
		}
	}
	if (externalParents.size === 0) {
		return;
	}

	const parentRows = await conn
		.select({
			uuid: transcriptRecord.uuid,
			sessionId: transcriptRecord.sessionId,
		})
		.from(transcriptRecord)
		.where(
			and(
				inArray(transcriptRecord.uuid, [...externalParents]),
				ne(transcriptRecord.sessionId, sessionId),
			),
		);
	const owners = new Map<string, string>();
	for (const p of parentRows) {
		owners.set(p.uuid, p.sessionId);
	}

	const fork = findForkPoint(ownUuids, candidates, (u) => owners.get(u));
	if (!fork) {
		return;
	}

	await conn
		.update(session)
		.set({
			forkedFromSessionId: fork.forkedFromSessionId,
			forkPointRecordUuid: fork.forkPointRecordUuid,
		})
		.where(
			and(
				eq(session.id, sessionId),
				// Re-check null to stay idempotent under concurrency.
				sql`${session.forkedFromSessionId} is null`,
			),
		);
}

/** Recompute recordCount, startedAt (min ts), lastActivityAt (max ts). */
export async function updateSessionStats(
	sessionId: string,
	conn: Tx = db,
): Promise<void> {
	const agg = await conn
		.select({
			count: sql<number>`count(*)::int`,
			minTs: min(transcriptRecord.ts),
			maxTs: max(transcriptRecord.ts),
		})
		.from(transcriptRecord)
		.where(eq(transcriptRecord.sessionId, sessionId));
	const row = agg.at(0);
	const count = row?.count ?? 0;

	await conn
		.update(session)
		.set({
			recordCount: count,
			startedAt: row?.minTs ?? null,
			lastActivityAt: row?.maxTs ?? null,
		})
		.where(eq(session.id, sessionId));
}
