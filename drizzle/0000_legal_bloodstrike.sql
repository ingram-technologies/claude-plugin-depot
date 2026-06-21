CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text,
	"vendor" text DEFAULT 'anthropic' NOT NULL,
	"vendor_account_id" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analysis_run" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"project_id" text,
	"session_id" text,
	"agent_id" text,
	"model" text,
	"stats" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "briefing" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"content" text NOT NULL,
	"state_of_mind" text,
	"generated_by_run_id" text,
	"entry_count_at_gen" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entry_curation" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_id" text NOT NULL,
	"person_id" text,
	"action" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_token" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"label" text,
	"person_id" text,
	"machine_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "knowledge_claim" (
	"id" text PRIMARY KEY NOT NULL,
	"analysis_run_id" text NOT NULL,
	"project_id" text NOT NULL,
	"session_id" text,
	"claim_type" text NOT NULL,
	"claim" text NOT NULL,
	"body" text,
	"scope" text,
	"fingerprint" text NOT NULL,
	"canonical_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_claim_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"claim_id" text NOT NULL,
	"record_uuid" text NOT NULL,
	"quote" text
);
--> statement-breakpoint
CREATE TABLE "knowledge_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"entry_type" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"claim" text NOT NULL,
	"body" text,
	"scope" text,
	"status" text DEFAULT 'active' NOT NULL,
	"superseded_by_id" text,
	"superseded_at" timestamp with time zone,
	"confidence" double precision DEFAULT 0 NOT NULL,
	"session_count" integer DEFAULT 0 NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"first_seen_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"last_confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_entry_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_id" text NOT NULL,
	"record_uuid" text NOT NULL,
	"via_claim_id" text,
	"session_id" text,
	"quote" text,
	"observed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machine" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text,
	"fingerprint" text NOT NULL,
	"hostname" text,
	"os" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"canonical_remote" text NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_path" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"machine_id" text NOT NULL,
	"abs_path" text NOT NULL,
	"git_remote_raw" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_session_id" text NOT NULL,
	"project_id" text,
	"machine_id" text NOT NULL,
	"account_id" text,
	"forked_from_session_id" text,
	"fork_point_record_uuid" text,
	"cwd" text,
	"git_branch" text,
	"client_version" text,
	"started_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone,
	"record_count" integer DEFAULT 0 NOT NULL,
	"analyzed_through_ts" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcript_file" (
	"id" text PRIMARY KEY NOT NULL,
	"sha256" text NOT NULL,
	"machine_id" text,
	"provider_session_id" text,
	"byte_size" bigint,
	"record_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcript_record" (
	"uuid" text PRIMARY KEY NOT NULL,
	"parent_uuid" text,
	"session_id" text NOT NULL,
	"provider_session_id" text NOT NULL,
	"record_type" text NOT NULL,
	"subtype" text,
	"is_sidechain" boolean DEFAULT false NOT NULL,
	"is_meta" boolean DEFAULT false NOT NULL,
	"role" text,
	"model" text,
	"cwd" text,
	"git_branch" text,
	"ts" timestamp with time zone,
	"seq" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"text_content" text,
	"tool_name" text,
	"raw" jsonb NOT NULL,
	"first_seen_file_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_run" ADD CONSTRAINT "analysis_run_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_run" ADD CONSTRAINT "analysis_run_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefing" ADD CONSTRAINT "briefing_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefing" ADD CONSTRAINT "briefing_generated_by_run_id_analysis_run_id_fk" FOREIGN KEY ("generated_by_run_id") REFERENCES "public"."analysis_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_curation" ADD CONSTRAINT "entry_curation_entry_id_knowledge_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."knowledge_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_curation" ADD CONSTRAINT "entry_curation_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_token" ADD CONSTRAINT "ingest_token_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_token" ADD CONSTRAINT "ingest_token_machine_id_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machine"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_claim" ADD CONSTRAINT "knowledge_claim_analysis_run_id_analysis_run_id_fk" FOREIGN KEY ("analysis_run_id") REFERENCES "public"."analysis_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_claim" ADD CONSTRAINT "knowledge_claim_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_claim" ADD CONSTRAINT "knowledge_claim_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_claim_evidence" ADD CONSTRAINT "knowledge_claim_evidence_claim_id_knowledge_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."knowledge_claim"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_claim_evidence" ADD CONSTRAINT "knowledge_claim_evidence_record_uuid_transcript_record_uuid_fk" FOREIGN KEY ("record_uuid") REFERENCES "public"."transcript_record"("uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_entry" ADD CONSTRAINT "knowledge_entry_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_entry_evidence" ADD CONSTRAINT "knowledge_entry_evidence_entry_id_knowledge_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."knowledge_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_entry_evidence" ADD CONSTRAINT "knowledge_entry_evidence_record_uuid_transcript_record_uuid_fk" FOREIGN KEY ("record_uuid") REFERENCES "public"."transcript_record"("uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_entry_evidence" ADD CONSTRAINT "knowledge_entry_evidence_via_claim_id_knowledge_claim_id_fk" FOREIGN KEY ("via_claim_id") REFERENCES "public"."knowledge_claim"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_entry_evidence" ADD CONSTRAINT "knowledge_entry_evidence_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine" ADD CONSTRAINT "machine_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_path" ADD CONSTRAINT "project_path_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_path" ADD CONSTRAINT "project_path_machine_id_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machine"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_machine_id_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machine"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_file" ADD CONSTRAINT "transcript_file_machine_id_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machine"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_record" ADD CONSTRAINT "transcript_record_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_record" ADD CONSTRAINT "transcript_record_first_seen_file_id_transcript_file_id_fk" FOREIGN KEY ("first_seen_file_id") REFERENCES "public"."transcript_file"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_vendor_uq" ON "account" USING btree ("vendor","vendor_account_id");--> statement-breakpoint
CREATE INDEX "analysis_run_project_idx" ON "analysis_run" USING btree ("project_id","kind");--> statement-breakpoint
CREATE INDEX "briefing_project_idx" ON "briefing" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "curation_entry_idx" ON "entry_curation" USING btree ("entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ingest_token_hash_uq" ON "ingest_token" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "claim_fingerprint_uq" ON "knowledge_claim" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "claim_project_type_idx" ON "knowledge_claim" USING btree ("project_id","claim_type");--> statement-breakpoint
CREATE INDEX "claim_canonical_idx" ON "knowledge_claim" USING btree ("canonical_id");--> statement-breakpoint
CREATE UNIQUE INDEX "claim_evidence_uq" ON "knowledge_claim_evidence" USING btree ("claim_id","record_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "entry_slug_uq" ON "knowledge_entry" USING btree ("project_id","slug");--> statement-breakpoint
CREATE INDEX "entry_project_status_idx" ON "knowledge_entry" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "entry_type_idx" ON "knowledge_entry" USING btree ("entry_type");--> statement-breakpoint
CREATE UNIQUE INDEX "entry_evidence_uq" ON "knowledge_entry_evidence" USING btree ("entry_id","record_uuid");--> statement-breakpoint
CREATE INDEX "entry_evidence_entry_idx" ON "knowledge_entry_evidence" USING btree ("entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "machine_fingerprint_uq" ON "machine" USING btree ("fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "project_remote_uq" ON "project" USING btree ("canonical_remote");--> statement-breakpoint
CREATE UNIQUE INDEX "project_slug_uq" ON "project" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "project_path_uq" ON "project_path" USING btree ("machine_id","abs_path");--> statement-breakpoint
CREATE INDEX "project_path_project_idx" ON "project_path" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_provider_uq" ON "session" USING btree ("provider_session_id","machine_id");--> statement-breakpoint
CREATE INDEX "session_project_idx" ON "session" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transcript_file_sha_uq" ON "transcript_file" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "record_session_idx" ON "transcript_record" USING btree ("session_id","ts");--> statement-breakpoint
CREATE INDEX "record_parent_idx" ON "transcript_record" USING btree ("parent_uuid");--> statement-breakpoint
CREATE INDEX "record_type_idx" ON "transcript_record" USING btree ("record_type");