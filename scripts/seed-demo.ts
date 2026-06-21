/**
 * DEV-ONLY demo seed. Inserts two projects with a handful of cited Memories,
 * evidence rows, supporting transcript records/sessions, and a briefing each,
 * so the UI is viewable before the real pipeline runs.
 *
 * Idempotent-ish: uses fixed ids + ON CONFLICT DO NOTHING / DO UPDATE, so
 * re-running refreshes content without duplicating rows. Do NOT run in prod.
 *
 *   bun run scripts/seed-demo.ts
 */

import { execute, pool } from "../src/lib/db";

if (process.env.NODE_ENV === "production") {
	throw new Error("seed-demo is dev-only; refusing to run with NODE_ENV=production");
}

const MACHINE = "mch_demoSeed00000000000";

type Mem = {
	id: string;
	type: "decision" | "gotcha" | "principle" | "state";
	slug: string;
	title: string;
	claim: string;
	body: string;
	scope: string;
	confidence: number;
	sessions: number;
	ageDays: number; // last seen N days ago
	evidence: { rec: string; quote: string; model: string; ageDays: number }[];
};

type Proj = {
	id: string;
	slug: string;
	name: string;
	remote: string;
	description: string;
	stateOfMind: string;
	brief: string;
	mems: Mem[];
};

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const PROJECTS: Proj[] = [
	{
		id: "prj_demoInfra0000000000",
		slug: "infra",
		name: "infra",
		remote: "github.com/ingram-technologies/infra",
		description: "Agent-operated Pulumi TS IaC across Cloudflare / DO / Vercel.",
		stateOfMind:
			"Mid-migration off Resend to the Cloudflare Email Service; the email path is the load-bearing risk this week.",
		brief: `## Current state

The estate is **agent-operated Pulumi TypeScript**. Transactional email is moving
from Resend to the in-house **Cloudflare Email Service** — see the decision below.

## Load-bearing decisions

- All transactional mail goes through \`@ingram-tech/email\`, never a raw client.
- Project identity is the **normalized git remote**, never an absolute path.

## Top gotchas

- Pulumi \`secret\` outputs leak into state diffs if interpolated into plain strings.`,
		mems: [
			{
				id: "ke_demoInfra000000000001",
				type: "decision",
				slug: "cloudflare-email-service",
				title: "Adopt Cloudflare Email Service",
				claim: "Transactional email moves from Resend to the in-house Cloudflare Email Service.",
				body: "Resend's per-domain limits and opaque deliverability pushed us to own the path. The Cloudflare worker fronts MailChannels and is reachable as @ingram-tech/email; no other mail client is permitted.",
				scope: "@ingram-tech/email",
				confidence: 0.86,
				sessions: 5,
				ageDays: 2,
				evidence: [
					{
						rec: "rec_infra_email_1",
						quote: "let's standardize on the Cloudflare email worker and kill the Resend dep",
						model: "claude-opus-4-8[1m]",
						ageDays: 2,
					},
					{
						rec: "rec_infra_email_2",
						quote: "fromAddress should come from @ingram-tech/email, nothing else",
						model: "claude-sonnet-4-5",
						ageDays: 9,
					},
				],
			},
			{
				id: "ke_demoInfra000000000002",
				type: "gotcha",
				slug: "pulumi-secret-leak",
				title: "Pulumi secrets leak via string interpolation",
				claim: "Interpolating a Pulumi secret output into a plain string leaks it into state diffs.",
				body: "Use pulumi.secret() and pass Output<string> through resource args directly. The moment you `${secret}` into a template literal, the resolved value lands in plaintext in the diff.",
				scope: "pulumi/",
				confidence: 0.72,
				sessions: 3,
				ageDays: 14,
				evidence: [
					{
						rec: "rec_infra_secret_1",
						quote: "the token showed up in the plan output — it was interpolated into a string",
						model: "claude-opus-4-8[1m]",
						ageDays: 14,
					},
				],
			},
			{
				id: "ke_demoInfra000000000003",
				type: "principle",
				slug: "remote-is-identity",
				title: "Git remote is project identity",
				claim: "A project is identified by its normalized git remote, never by an absolute path.",
				body: "Worktrees and monorepo subdirs mean many paths map to one project. The normalized remote is the only stable key; abs paths are per-machine reality stored separately.",
				scope: "src/lib/ingest/project.ts",
				confidence: 0.91,
				sessions: 8,
				ageDays: 30,
				evidence: [
					{
						rec: "rec_infra_id_1",
						quote: "never let the abs path own identity — normalize the remote",
						model: "claude-opus-4-8[1m]",
						ageDays: 30,
					},
				],
			},
			{
				id: "ke_demoInfra000000000004",
				type: "state",
				slug: "stale-terraform-import",
				title: "Legacy Terraform import is stale",
				claim: "The half-finished Terraform-to-Pulumi import for the DO droplets is abandoned.",
				body: "We chose to recreate rather than import. This note is kept so nobody resurrects the import branch.",
				scope: "pulumi/legacy",
				confidence: 0.3,
				sessions: 1,
				ageDays: 140,
				evidence: [
					{
						rec: "rec_infra_tf_1",
						quote: "drop the import, just recreate the droplets in Pulumi",
						model: "claude-sonnet-4-5",
						ageDays: 140,
					},
				],
			},
		],
	},
	{
		id: "prj_demoDepot0000000000",
		slug: "depot",
		name: "depot",
		remote: "github.com/ingram-technologies/depot.ingram.tech",
		description:
			"Distills Claude Code transcripts into cited per-project Memories.",
		stateOfMind:
			"The transcripts → trusted, cited Memories core is nailed; the web UI is the current front.",
		brief: `## Current state

Depot deliberately nails **transcripts → trusted, cited Memories** first. The
two-stage pipeline (extract → canonicalize) is in place; the web UI is the
active front.

## Load-bearing decisions

- A fuzzy/LLM process never owns a unique key — claim identity is a deterministic fingerprint.
- Every Memory must carry provenance to real transcript-record uuids.

## Top gotchas

- Confidence is **derived**, never authored — don't let the LLM write it.`,
		mems: [
			{
				id: "ke_demoDepot000000000001",
				type: "principle",
				slug: "no-fuzzy-unique-keys",
				title: "No fuzzy process owns a unique key",
				claim: "A nondeterministic/LLM process never owns a unique key in the schema.",
				body: "Project identity = git remote; claim identity = deterministic fingerprint; record identity = the producer's own uuid. This makes re-runs idempotent and merges reversible without re-invoking the model.",
				scope: "src/lib/schema.ts",
				confidence: 0.94,
				sessions: 7,
				ageDays: 1,
				evidence: [
					{
						rec: "rec_depot_key_1",
						quote: "the fingerprint is hash(run, sorted evidence uuids, normalized content)",
						model: "claude-opus-4-8[1m]",
						ageDays: 1,
					},
					{
						rec: "rec_depot_key_2",
						quote: "never let the canonicalizer mint entry identity",
						model: "claude-opus-4-8[1m]",
						ageDays: 5,
					},
				],
			},
			{
				id: "ke_demoDepot000000000002",
				type: "decision",
				slug: "precision-over-recall",
				title: "Extractor optimizes precision over recall",
				claim: "The extractor favors a sparse trustworthy memory over a dense doubted one.",
				body: "Suppression is the hard part. A Memory with no receipts cannot exist; we'd rather miss a lesson than surface an unfalsifiable one.",
				scope: "src/lib/pipeline/extract.ts",
				confidence: 0.8,
				sessions: 4,
				ageDays: 6,
				evidence: [
					{
						rec: "rec_depot_prec_1",
						quote: "precision over recall — a sparse trustworthy memory beats a dense doubted one",
						model: "claude-opus-4-8[1m]",
						ageDays: 6,
					},
				],
			},
			{
				id: "ke_demoDepot000000000003",
				type: "gotcha",
				slug: "confidence-is-derived",
				title: "Confidence is derived, not authored",
				claim: "Confidence is a function of sessions/recency/contradiction — never written by the LLM.",
				body: "If the model emits a confidence number, ignore it. Confidence is recomputed from evidence so it stays falsifiable and a human confirm can override it.",
				scope: "src/lib/pipeline/confidence.ts",
				confidence: 0.68,
				sessions: 3,
				ageDays: 18,
				evidence: [
					{
						rec: "rec_depot_conf_1",
						quote: "shown as 'seen in 4 sessions over 3 months', not a vibe percentage",
						model: "claude-sonnet-4-5",
						ageDays: 18,
					},
				],
			},
		],
	},
];

async function seed() {
	// machine + person for attribution
	await execute(
		`insert into machine (id, fingerprint, hostname, os)
		 values ($1, 'demo-seed-fp', 'demo-host', 'linux')
		 on conflict (id) do nothing`,
		[MACHINE],
	);

	for (const p of PROJECTS) {
		await execute(
			`insert into project (id, canonical_remote, slug, display_name, description, last_activity_at)
			 values ($1, $2, $3, $4, $5, $6)
			 on conflict (id) do update set
			   display_name = excluded.display_name,
			   description = excluded.description,
			   last_activity_at = excluded.last_activity_at`,
			[p.id, p.remote, p.slug, p.name, p.description, ago(1)],
		);

		// a few sessions for the sparkline
		for (let i = 0; i < 12; i++) {
			const sid = `ses_demo_${p.slug}_${i}`;
			await execute(
				`insert into session (id, provider_session_id, project_id, machine_id, started_at, last_activity_at, record_count)
				 values ($1, $2, $3, $4, $5, $5, 3)
				 on conflict (id) do nothing`,
				[sid, `prov_${p.slug}_${i}`, p.id, MACHINE, ago(i * 2 + 1)],
			);
		}

		const briefSession = `ses_demo_${p.slug}_0`;

		for (const m of p.mems) {
			await execute(
				`insert into knowledge_entry
				   (id, project_id, entry_type, slug, title, claim, body, scope, status,
				    confidence, session_count, first_seen_at, last_seen_at, updated_at)
				 values ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$10,$11,$12,$13)
				 on conflict (id) do update set
				   claim = excluded.claim, body = excluded.body, scope = excluded.scope,
				   confidence = excluded.confidence, session_count = excluded.session_count,
				   last_seen_at = excluded.last_seen_at, updated_at = excluded.updated_at`,
				[
					m.id,
					p.id,
					m.type,
					m.slug,
					m.title,
					m.claim,
					m.body,
					m.scope,
					m.confidence,
					m.sessions,
					ago(m.ageDays + 120),
					ago(m.ageDays),
					ago(m.ageDays),
				],
			);

			for (const ev of m.evidence) {
				// transcript record (provenance target)
				await execute(
					`insert into transcript_record
					   (uuid, session_id, provider_session_id, record_type, role, model, ts, seq, text_content, raw)
					 values ($1,$2,$3,'message','assistant',$4,$5,0,$6,$7)
					 on conflict (uuid) do update set
					   text_content = excluded.text_content, model = excluded.model`,
					[
						ev.rec,
						briefSession,
						`prov_${p.slug}_0`,
						ev.model,
						ago(ev.ageDays),
						`${ev.quote}\n\n(full transcript record text would appear here; this is demo seed content illustrating the inline source expansion in the Evidence block.)`,
						JSON.stringify({ demo: true, quote: ev.quote }),
					],
				);

				await execute(
					`insert into knowledge_entry_evidence
					   (id, entry_id, record_uuid, session_id, quote, observed_at)
					 values ($1,$2,$3,$4,$5,$6)
					 on conflict (entry_id, record_uuid) do update set quote = excluded.quote`,
					[
						`ev_${ev.rec}`,
						m.id,
						ev.rec,
						briefSession,
						ev.quote,
						ago(ev.ageDays),
					],
				);
			}
		}

		// briefing
		await execute(
			`insert into briefing (id, project_id, content, state_of_mind, entry_count_at_gen)
			 values ($1,$2,$3,$4,$5)
			 on conflict (id) do update set
			   content = excluded.content, state_of_mind = excluded.state_of_mind,
			   entry_count_at_gen = excluded.entry_count_at_gen`,
			[`brf_demo_${p.slug}`, p.id, p.brief, p.stateOfMind, p.mems.length],
		);
	}

	// supersession demo: infra's stale terraform note is superseded by the decision
	await execute(`update knowledge_entry set superseded_by_id = $1 where id = $2`, [
		"ke_demoInfra000000000001",
		"ke_demoInfra000000000004",
	]);

	console.log(`seeded ${PROJECTS.length} demo projects`);
}

seed()
	.then(() => pool.end())
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
