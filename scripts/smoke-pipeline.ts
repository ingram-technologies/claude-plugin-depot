/**
 * Dev smoke test for the LLM pipeline against LIVE Ingram Cloud.
 * Bounded: extracts the top N sessions of one project, canonicalizes, briefs.
 * Run: (env with DATABASE_URL + INGRAM_CLOUD_TOKEN + DEPOT_*_AGENT_ID)
 *   bunx tsx scripts/smoke-pipeline.ts <projectSlugOrRemoteSubstr> [N]
 */
import { desc, eq, like } from "drizzle-orm";

import { db, pool, schema } from "../src/lib/db";
import { canonicalizeProject } from "../src/lib/pipeline/canonicalize";
import { generateBriefing } from "../src/lib/pipeline/brief";
import { extractSession } from "../src/lib/pipeline/extract";

async function main() {
	const needle = process.argv[2] ?? "nextkit";
	const limit = Number(process.argv[3] ?? "4");

	const proj = await db
		.select()
		.from(schema.project)
		.where(like(schema.project.canonicalRemote, `%${needle}%`))
		.limit(1);
	const project = proj[0];
	if (!project) throw new Error(`no project matching ${needle}`);
	console.log(`project: ${project.slug} (${project.id}) ${project.canonicalRemote}`);

	const sessions = await db
		.select()
		.from(schema.session)
		.where(eq(schema.session.projectId, project.id))
		.orderBy(desc(schema.session.recordCount))
		.limit(limit);
	console.log(`extracting top ${sessions.length} sessions by record count…`);

	for (const s of sessions) {
		try {
			const r = await extractSession(s.id);
			console.log(
				`  ${s.providerSessionId.slice(0, 8)} (${s.recordCount} rec) → ${JSON.stringify(r)}`,
			);
		} catch (e) {
			console.log(
				`  ${s.providerSessionId.slice(0, 8)} extract FAILED: ${String(e).slice(0, 200)}`,
			);
		}
	}

	console.log("\ncanonicalizing…");
	const canon = await canonicalizeProject(project.id);
	console.log(`  → ${JSON.stringify(canon)}`);

	console.log("\nbriefing…");
	const brief = await generateBriefing(project.id);
	console.log(`  → ${JSON.stringify(brief).slice(0, 300)}`);

	const entries = await db
		.select()
		.from(schema.knowledgeEntry)
		.where(eq(schema.knowledgeEntry.projectId, project.id))
		.orderBy(desc(schema.knowledgeEntry.confidence));
	console.log(`\n=== ${entries.length} Memories ===`);
	for (const e of entries.slice(0, 15)) {
		console.log(
			`[${e.entryType}] (conf ${e.confidence.toFixed(2)}, ${e.sessionCount} sess) ${e.claim}`,
		);
	}

	await pool.end();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
