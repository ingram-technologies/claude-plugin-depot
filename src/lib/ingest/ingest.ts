/**
 * Ingest orchestration. Turns one validated upload payload into idempotent DB
 * writes: identity → project → session → records → fork → stats, with each
 * FILE wrapped in its own transaction.
 *
 * Idempotency contract:
 *   - Identical file bytes (sha256) → skip records, still 200, count duplicate.
 *   - Identical records (uuid) → onConflictDoNothing, count deduped.
 *   - Re-POSTing the same upload changes nothing.
 */

import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";

import { resolveAccount, resolveMachine } from "./identity";
import { ingestRecords } from "./records";
import { detectFork, resolveSession, updateSessionStats } from "./session";
import { resolveProject } from "./project";
import type { IngestAuth } from "./tokens";
import type { Tx } from "./tx";

const { transcriptFile, project, session } = schema;

export type IngestFile = {
	providerSessionId: string;
	projectPathAbs: string;
	gitRemoteRaw?: string;
	gitBranch?: string;
	sha256: string;
	records: unknown[];
};

export type IngestPayload = {
	machine: { fingerprint: string; hostname?: string; os?: string };
	account: { vendor: string; vendorAccountId: string; email?: string };
	files: IngestFile[];
};

export type IngestResponse = {
	ok: true;
	files: { accepted: number; duplicate: number };
	records: { inserted: number; deduped: number };
	sessions: Array<{
		id: string;
		providerSessionId: string;
		recordCount: number;
	}>;
};

/** Orchestrate an upload. Each file commits independently. */
export async function ingestUpload(
	payload: IngestPayload,
	auth: IngestAuth,
): Promise<IngestResponse> {
	let filesAccepted = 0;
	let filesDuplicate = 0;
	let recordsInserted = 0;
	let recordsDeduped = 0;

	const sessionsTouched = new Map<
		string,
		{ id: string; providerSessionId: string; recordCount: number }
	>();
	const projectsTouched = new Set<string>();

	for (const file of payload.files) {
		const outcome = await db.transaction((tx) =>
			ingestFile(tx, payload, auth, file),
		);

		if (outcome.duplicateFile) {
			filesDuplicate += 1;
		} else {
			filesAccepted += 1;
		}
		recordsInserted += outcome.inserted;
		recordsDeduped += outcome.deduped;
		projectsTouched.add(outcome.projectId);
		sessionsTouched.set(outcome.sessionId, {
			id: outcome.sessionId,
			providerSessionId: file.providerSessionId,
			recordCount: outcome.recordCount,
		});
	}

	// Bump project activity once per affected project (best-effort, post-commit).
	const nowTs = new Date();
	for (const projectId of projectsTouched) {
		await db
			.update(project)
			.set({ lastActivityAt: nowTs })
			.where(eq(project.id, projectId));
	}

	return {
		ok: true,
		files: { accepted: filesAccepted, duplicate: filesDuplicate },
		records: { inserted: recordsInserted, deduped: recordsDeduped },
		sessions: [...sessionsTouched.values()],
	};
}

type FileOutcome = {
	duplicateFile: boolean;
	projectId: string;
	sessionId: string;
	recordCount: number;
	inserted: number;
	deduped: number;
};

async function ingestFile(
	tx: Tx,
	payload: IngestPayload,
	auth: IngestAuth,
	file: IngestFile,
): Promise<FileOutcome> {
	const machine = await resolveMachine(payload.machine, auth.personId, tx);
	const account = await resolveAccount(payload.account, tx);
	const proj = await resolveProject(
		{
			machineId: machine.id,
			machineFingerprint: payload.machine.fingerprint,
			projectPathAbs: file.projectPathAbs,
			gitRemoteRaw: file.gitRemoteRaw,
			organizationId: auth.organizationId,
		},
		tx,
	);
	const sess = await resolveSession(
		{
			providerSessionId: file.providerSessionId,
			machineId: machine.id,
			accountId: account.id,
			projectId: proj.id,
			organizationId: auth.organizationId,
			personId: auth.personId,
			cwd: file.projectPathAbs,
			gitBranch: file.gitBranch,
		},
		tx,
	);

	// File-level dedup by sha256. If the exact bytes are known, skip records.
	const fileId = newId("file");
	const insertedFile = await tx
		.insert(transcriptFile)
		.values({
			id: fileId,
			sha256: file.sha256,
			machineId: machine.id,
			providerSessionId: file.providerSessionId,
			recordCount: file.records.length,
		})
		.onConflictDoNothing({ target: transcriptFile.sha256 })
		.returning({ id: transcriptFile.id });

	const isDuplicateFile = insertedFile.length === 0;

	if (isDuplicateFile) {
		// Known bytes: do not re-process records. Stats already reflect them.
		const existing = await tx
			.select({ recordCount: session.recordCount })
			.from(session)
			.where(eq(session.id, sess.id))
			.limit(1);
		return {
			duplicateFile: true,
			projectId: proj.id,
			sessionId: sess.id,
			recordCount: existing.at(0)?.recordCount ?? 0,
			inserted: 0,
			deduped: 0,
		};
	}

	const result = await ingestRecords(
		sess.id,
		file.providerSessionId,
		fileId,
		file.records,
		tx,
	);

	await detectFork(sess.id, tx);
	await updateSessionStats(sess.id, tx);

	// "Needs (re)analysis" is implicit: updateSessionStats sets lastActivityAt
	// from max(ts); we deliberately leave analyzedThroughTs untouched, so when
	// new records land after the cursor, lastActivityAt > analyzedThroughTs and
	// the pipeline picks the session up. No mutation needed here.

	const after = await tx
		.select({ recordCount: session.recordCount })
		.from(session)
		.where(eq(session.id, sess.id))
		.limit(1);

	return {
		duplicateFile: false,
		projectId: proj.id,
		sessionId: sess.id,
		recordCount: after.at(0)?.recordCount ?? result.inserted,
		inserted: result.inserted,
		deduped: result.deduped,
	};
}
