CREATE TABLE "auth_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
DROP INDEX "project_remote_uq";--> statement-breakpoint
DROP INDEX "project_slug_uq";--> statement-breakpoint
ALTER TABLE "ingest_token" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "auth_user_id" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "person_id" text;--> statement-breakpoint
ALTER TABLE "auth_session" ADD COLUMN "active_organization_id" text;--> statement-breakpoint
ALTER TABLE "auth_user" ADD COLUMN "last_active_organization_id" text;--> statement-breakpoint
ALTER TABLE "auth_invitation" ADD CONSTRAINT "auth_invitation_organization_id_auth_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."auth_organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_invitation" ADD CONSTRAINT "auth_invitation_inviter_id_auth_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_member" ADD CONSTRAINT "auth_member_organization_id_auth_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."auth_organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_member" ADD CONSTRAINT "auth_member_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "person_auth_user_uq" ON "person" USING btree ("auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_org_remote_uq" ON "project" USING btree ("organization_id","canonical_remote");--> statement-breakpoint
CREATE UNIQUE INDEX "project_org_slug_uq" ON "project" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "project_org_idx" ON "project" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "session_org_idx" ON "session" USING btree ("organization_id");