/**
 * Depot schema — the keystone. See ARCHITECTURE.md.
 *
 * Three layers, hard-separated:
 *   1. Immutable facts  (transcript_file, transcript_record, session) + identity
 *      (person, account, machine, project, project_path)
 *   2. Append-only LLM output (analysis_run, knowledge_claim + evidence)
 *   3. Canonical curated knowledge (knowledge_entry + evidence, entry_curation,
 *      briefing)
 *
 * Invariant: a fuzzy/nondeterministic process never owns a unique key.
 * Project identity = normalized git remote. Claim identity = deterministic
 * fingerprint. Record identity = the producer's own uuid.
 */

import { relations, sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	doublePrecision,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

const now = () =>
	timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ── Identity ────────────────────────────────────────────────────────────────

export const person = pgTable(
	"person",
	{
		id: text("id").primaryKey(),
		/** Links this domain person to its Better Auth user (1:1), when signed in
		 *  through the web. Null for people seen only via uploads. */
		authUserId: text("auth_user_id"),
		displayName: text("display_name").notNull(),
		email: text("email"),
		createdAt: now(),
	},
	(t) => [uniqueIndex("person_auth_user_uq").on(t.authUserId)],
);

/** A Claude/AI assistant account, soft-owned by a person. (machine + account
 *  identify the uploader, per the product brief.) */
export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		personId: text("person_id").references(() => person.id),
		vendor: text("vendor").notNull().default("anthropic"),
		vendorAccountId: text("vendor_account_id").notNull(),
		email: text("email"),
		createdAt: now(),
	},
	(t) => [uniqueIndex("account_vendor_uq").on(t.vendor, t.vendorAccountId)],
);

export const machine = pgTable(
	"machine",
	{
		id: text("id").primaryKey(),
		personId: text("person_id").references(() => person.id),
		/** Stable per-install fingerprint sent by the plugin. */
		fingerprint: text("fingerprint").notNull(),
		hostname: text("hostname"),
		os: text("os"),
		createdAt: now(),
		lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
	},
	(t) => [uniqueIndex("machine_fingerprint_uq").on(t.fingerprint)],
);

/** A project is identified by its normalized git remote, never an abs path. */
export const project = pgTable(
	"project",
	{
		id: text("id").primaryKey(),
		/** Owning organization (tenant). A project's Memories belong to its org. */
		organizationId: text("organization_id"),
		/** Normalized remote, e.g. `github.com/ingram-technologies/depot.ingram.tech`.
		 *  For repos without a remote: `local:<machine fp>:<abs path>`. */
		canonicalRemote: text("canonical_remote").notNull(),
		slug: text("slug").notNull(),
		displayName: text("display_name").notNull(),
		description: text("description"),
		createdAt: now(),
		lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
	},
	(t) => [
		// Identity is the remote/slug WITHIN an org, so two orgs can keep memory
		// for the same upstream repo without colliding.
		uniqueIndex("project_org_remote_uq").on(t.organizationId, t.canonicalRemote),
		uniqueIndex("project_org_slug_uq").on(t.organizationId, t.slug),
		index("project_org_idx").on(t.organizationId),
	],
);

/** The messy per-machine reality: which abs path on which machine is which
 *  project. Many paths (worktrees, monorepo subdirs) → one project. */
export const projectPath = pgTable(
	"project_path",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id),
		machineId: text("machine_id")
			.notNull()
			.references(() => machine.id),
		absPath: text("abs_path").notNull(),
		gitRemoteRaw: text("git_remote_raw"),
		createdAt: now(),
	},
	(t) => [
		uniqueIndex("project_path_uq").on(t.machineId, t.absPath),
		index("project_path_project_idx").on(t.projectId),
	],
);

/** Bearer tokens the plugin uses to upload. We store only a hash. */
export const ingestToken = pgTable(
	"ingest_token",
	{
		id: text("id").primaryKey(),
		tokenHash: text("token_hash").notNull(),
		label: text("label"),
		personId: text("person_id").references(() => person.id),
		/** Tenant the token's uploads attribute to. */
		organizationId: text("organization_id"),
		machineId: text("machine_id").references(() => machine.id),
		createdAt: now(),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
	},
	(t) => [uniqueIndex("ingest_token_hash_uq").on(t.tokenHash)],
);

// ── Layer 1: immutable transcript facts ──────────────────────────────────────

/** A physical .jsonl upload. sha256 of bytes → identical re-upload is a no-op. */
export const transcriptFile = pgTable(
	"transcript_file",
	{
		id: text("id").primaryKey(),
		sha256: text("sha256").notNull(),
		machineId: text("machine_id").references(() => machine.id),
		providerSessionId: text("provider_session_id"),
		byteSize: bigint("byte_size", { mode: "number" }),
		recordCount: integer("record_count"),
		ingestedAt: now(),
	},
	(t) => [uniqueIndex("transcript_file_sha_uq").on(t.sha256)],
);

/** The logical conversation. `sessionId` is only unique per machine. A
 *  resumed/forked session is a NEW row whose parent points into an old one. */
export const session = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		providerSessionId: text("provider_session_id").notNull(),
		projectId: text("project_id").references(() => project.id),
		/** Owning tenant + producer, carried from the upload's ingest token so a
		 *  session attributes to the right org/person. */
		organizationId: text("organization_id"),
		personId: text("person_id").references(() => person.id),
		machineId: text("machine_id")
			.notNull()
			.references(() => machine.id),
		accountId: text("account_id").references(() => account.id),
		forkedFromSessionId: text("forked_from_session_id"),
		forkPointRecordUuid: text("fork_point_record_uuid"),
		cwd: text("cwd"),
		gitBranch: text("git_branch"),
		clientVersion: text("client_version"),
		startedAt: timestamp("started_at", { withTimezone: true }),
		lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
		recordCount: integer("record_count").notNull().default(0),
		/** Bumped when new records land; drives "needs (re)analysis". */
		analyzedThroughTs: timestamp("analyzed_through_ts", {
			withTimezone: true,
		}),
		createdAt: now(),
	},
	(t) => [
		uniqueIndex("session_provider_uq").on(t.providerSessionId, t.machineId),
		index("session_project_idx").on(t.projectId),
		index("session_org_idx").on(t.organizationId),
	],
);

/** Grain = one transcript record. Dedup key = the producer's `uuid`.
 *  Stored verbatim (raw jsonb) AND projected for query. parent_uuid is a SOFT
 *  pointer (records arrive out of order), not an FK. */
export const transcriptRecord = pgTable(
	"transcript_record",
	{
		uuid: text("uuid").primaryKey(),
		parentUuid: text("parent_uuid"),
		sessionId: text("session_id")
			.notNull()
			.references(() => session.id),
		providerSessionId: text("provider_session_id").notNull(),
		recordType: text("record_type").notNull(),
		subtype: text("subtype"),
		isSidechain: boolean("is_sidechain").notNull().default(false),
		isMeta: boolean("is_meta").notNull().default(false),
		role: text("role"),
		model: text("model"),
		cwd: text("cwd"),
		gitBranch: text("git_branch"),
		ts: timestamp("ts", { withTimezone: true }),
		/** Monotonic order within the file as received (tie-breaker for ts). */
		seq: integer("seq").notNull().default(0),
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),
		cacheReadTokens: integer("cache_read_tokens"),
		/** Flattened, human-readable text for FTS / extraction context. */
		textContent: text("text_content"),
		toolName: text("tool_name"),
		raw: jsonb("raw").notNull(),
		firstSeenFileId: text("first_seen_file_id").references(() => transcriptFile.id),
		createdAt: now(),
	},
	(t) => [
		index("record_session_idx").on(t.sessionId, t.ts),
		index("record_parent_idx").on(t.parentUuid),
		index("record_type_idx").on(t.recordType),
	],
);

// ── Layer 2: append-only LLM output ──────────────────────────────────────────

/** One LLM pass (extract over a session, canonicalize a project, brief). */
export const analysisRun = pgTable(
	"analysis_run",
	{
		id: text("id").primaryKey(),
		kind: text("kind").notNull(), // extract | canonicalize | brief
		status: text("status").notNull().default("running"), // running|done|error
		projectId: text("project_id").references(() => project.id),
		sessionId: text("session_id").references(() => session.id),
		agentId: text("agent_id"),
		model: text("model"),
		stats: jsonb("stats"),
		error: text("error"),
		startedAt: now(),
		finishedAt: timestamp("finished_at", { withTimezone: true }),
	},
	(t) => [index("analysis_run_project_idx").on(t.projectId, t.kind)],
);

/** Raw, append-only extraction output. The LLM writes here freely.
 *  fingerprint UNIQUE makes re-running a pass insert nothing new. */
export const knowledgeClaim = pgTable(
	"knowledge_claim",
	{
		id: text("id").primaryKey(),
		analysisRunId: text("analysis_run_id")
			.notNull()
			.references(() => analysisRun.id),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id),
		sessionId: text("session_id").references(() => session.id),
		claimType: text("claim_type").notNull(), // decision|gotcha|principle|state
		claim: text("claim").notNull(),
		body: text("body"),
		scope: text("scope"),
		/** hash(runId|claimType|normalized claim|sorted evidence uuids). */
		fingerprint: text("fingerprint").notNull(),
		/** Set by the canonicalize stage; null = not yet clustered. */
		canonicalId: text("canonical_id"),
		createdAt: now(),
	},
	(t) => [
		uniqueIndex("claim_fingerprint_uq").on(t.fingerprint),
		index("claim_project_type_idx").on(t.projectId, t.claimType),
		index("claim_canonical_idx").on(t.canonicalId),
	],
);

export const knowledgeClaimEvidence = pgTable(
	"knowledge_claim_evidence",
	{
		id: text("id").primaryKey(),
		claimId: text("claim_id")
			.notNull()
			.references(() => knowledgeClaim.id),
		recordUuid: text("record_uuid")
			.notNull()
			.references(() => transcriptRecord.uuid),
		quote: text("quote"),
	},
	(t) => [uniqueIndex("claim_evidence_uq").on(t.claimId, t.recordUuid)],
);

// ── Layer 3: canonical curated knowledge (the "Memory") ──────────────────────

export const knowledgeEntry = pgTable(
	"knowledge_entry",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id),
		entryType: text("entry_type").notNull(), // decision|gotcha|principle|state
		slug: text("slug").notNull(),
		title: text("title").notNull(),
		claim: text("claim").notNull(),
		body: text("body"),
		scope: text("scope"),
		status: text("status").notNull().default("active"), // active|superseded|contested|retired
		supersededById: text("superseded_by_id"),
		supersededAt: timestamp("superseded_at", { withTimezone: true }),
		/** Derived from evidence: sessions, recency, contradiction. 0..1. */
		confidence: doublePrecision("confidence").notNull().default(0),
		sessionCount: integer("session_count").notNull().default(0),
		tags: jsonb("tags")
			.$type<string[]>()
			.notNull()
			.default(sql`'[]'::jsonb`),
		firstSeenAt: timestamp("first_seen_at", { withTimezone: true }),
		lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
		lastConfirmedAt: timestamp("last_confirmed_at", { withTimezone: true }),
		createdAt: now(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		uniqueIndex("entry_slug_uq").on(t.projectId, t.slug),
		index("entry_project_status_idx").on(t.projectId, t.status),
		index("entry_type_idx").on(t.entryType),
	],
);

/** Rolled-up provenance: canonical entry → real records, across all sessions.
 *  10 sessions = 10 rows, ONE entry. via_claim_id keeps entry←claim←record. */
export const knowledgeEntryEvidence = pgTable(
	"knowledge_entry_evidence",
	{
		id: text("id").primaryKey(),
		entryId: text("entry_id")
			.notNull()
			.references(() => knowledgeEntry.id),
		recordUuid: text("record_uuid")
			.notNull()
			.references(() => transcriptRecord.uuid),
		viaClaimId: text("via_claim_id").references(() => knowledgeClaim.id),
		sessionId: text("session_id").references(() => session.id),
		quote: text("quote"),
		observedAt: timestamp("observed_at", { withTimezone: true }),
		createdAt: now(),
	},
	(t) => [
		uniqueIndex("entry_evidence_uq").on(t.entryId, t.recordUuid),
		index("entry_evidence_entry_idx").on(t.entryId),
	],
);

/** One human confirm/dispute/outdated outranks any AI confidence. */
export const entryCuration = pgTable(
	"entry_curation",
	{
		id: text("id").primaryKey(),
		entryId: text("entry_id")
			.notNull()
			.references(() => knowledgeEntry.id),
		personId: text("person_id").references(() => person.id),
		action: text("action").notNull(), // confirm|dispute|outdated|edit
		note: text("note"),
		createdAt: now(),
	},
	(t) => [index("curation_entry_idx").on(t.entryId)],
);

/** Cached per-project briefing (the hook). Regenerated on material change. */
export const briefing = pgTable(
	"briefing",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id),
		content: text("content").notNull(),
		stateOfMind: text("state_of_mind"),
		generatedByRunId: text("generated_by_run_id").references(() => analysisRun.id),
		entryCountAtGen: integer("entry_count_at_gen"),
		createdAt: now(),
	},
	(t) => [index("briefing_project_idx").on(t.projectId, t.createdAt)],
);

// ── Relations ────────────────────────────────────────────────────────────────

export const projectRelations = relations(project, ({ many }) => ({
	paths: many(projectPath),
	sessions: many(session),
	entries: many(knowledgeEntry),
}));

export const sessionRelations = relations(session, ({ one, many }) => ({
	project: one(project, {
		fields: [session.projectId],
		references: [project.id],
	}),
	machine: one(machine, {
		fields: [session.machineId],
		references: [machine.id],
	}),
	records: many(transcriptRecord),
}));

export const recordRelations = relations(transcriptRecord, ({ one }) => ({
	session: one(session, {
		fields: [transcriptRecord.sessionId],
		references: [session.id],
	}),
}));

export const claimRelations = relations(knowledgeClaim, ({ one, many }) => ({
	run: one(analysisRun, {
		fields: [knowledgeClaim.analysisRunId],
		references: [analysisRun.id],
	}),
	evidence: many(knowledgeClaimEvidence),
}));

export const entryRelations = relations(knowledgeEntry, ({ one, many }) => ({
	project: one(project, {
		fields: [knowledgeEntry.projectId],
		references: [project.id],
	}),
	evidence: many(knowledgeEntryEvidence),
	curations: many(entryCuration),
	supersededBy: one(knowledgeEntry, {
		fields: [knowledgeEntry.supersededById],
		references: [knowledgeEntry.id],
		relationName: "supersession",
	}),
}));

export const entryEvidenceRelations = relations(knowledgeEntryEvidence, ({ one }) => ({
	entry: one(knowledgeEntry, {
		fields: [knowledgeEntryEvidence.entryId],
		references: [knowledgeEntry.id],
	}),
	record: one(transcriptRecord, {
		fields: [knowledgeEntryEvidence.recordUuid],
		references: [transcriptRecord.uuid],
	}),
}));
