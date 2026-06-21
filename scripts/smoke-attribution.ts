/**
 * Dev smoke test for org/person attribution. Two orgs upload the SAME synthetic
 * transcript via personal tokens; assert two distinct projects, each stamped to
 * its org + person. Run: DATABASE_URL=… bunx tsx scripts/smoke-attribution.ts
 */
import { and, eq } from "drizzle-orm";

import { db, pool, schema } from "../src/lib/db";
import { ingestUpload } from "../src/lib/ingest";
import { issueIngestToken, verifyIngestToken } from "../src/lib/ingest/tokens";
import { newId } from "../src/lib/ids";

function syntheticFile(sessionId: string) {
	const base = {
		sessionId,
		cwd: "/home/dev/acme-app",
		gitBranch: "main",
		timestamp: new Date().toISOString(),
	};
	return {
		providerSessionId: sessionId,
		projectPathAbs: "/home/dev/acme-app",
		gitRemoteRaw: "git@github.com:acme/acme-app.git",
		gitBranch: "main",
		sha256: newId("file") + sessionId, // unique per upload so file-dedup doesn't skip
		records: [
			{
				...base,
				uuid: newId("evidence"),
				type: "user",
				parentUuid: null,
				message: { role: "user", content: "set up the db" },
			},
			{
				...base,
				uuid: newId("evidence"),
				type: "assistant",
				message: {
					role: "assistant",
					model: "claude",
					content: [{ type: "text", text: "done" }],
				},
			},
		],
	};
}

async function makePerson(name: string) {
	const id = newId("person");
	await db.insert(schema.person).values({ id, displayName: name, authUserId: id });
	return id;
}

async function main() {
	const orgA = "org_AAA";
	const orgB = "org_BBB";
	const personA = await makePerson("Alice");
	const personB = await makePerson("Bob");

	const { token: tokA } = await issueIngestToken({
		label: "A",
		personId: personA,
		organizationId: orgA,
	});
	const { token: tokB } = await issueIngestToken({
		label: "B",
		personId: personB,
		organizationId: orgB,
	});
	const authA = await verifyIngestToken(tokA);
	const authB = await verifyIngestToken(tokB);
	if (!authA || !authB) throw new Error("verify failed");
	console.log("authA org:", authA.organizationId, "person:", authA.personId);
	console.log("authB org:", authB.organizationId, "person:", authB.personId);

	const machine = { fingerprint: "fp", hostname: "h", os: "linux" };
	const account = { vendor: "anthropic" as const, vendorAccountId: "acct" };

	await ingestUpload({ machine, account, files: [syntheticFile("sess-A")] }, authA);
	await ingestUpload({ machine, account, files: [syntheticFile("sess-B")] }, authB);

	const projects = await db
		.select({
			id: schema.project.id,
			org: schema.project.organizationId,
			slug: schema.project.slug,
			remote: schema.project.canonicalRemote,
		})
		.from(schema.project)
		.where(eq(schema.project.canonicalRemote, "github.com/acme/acme-app"));
	console.log("projects for same remote:", JSON.stringify(projects, null, 2));

	const sessions = await db
		.select({
			org: schema.session.organizationId,
			person: schema.session.personId,
			project: schema.session.projectId,
		})
		.from(schema.session);
	console.log("sessions:", JSON.stringify(sessions, null, 2));

	const orgs = new Set(projects.map((p) => p.org));
	const twoProjects = projects.length === 2 && orgs.has(orgA) && orgs.has(orgB);
	const sessionsStamped = sessions.every((s) => s.org && s.person);
	console.log(`\nTWO ORGS → TWO PROJECTS: ${twoProjects ? "PASS ✅" : "FAIL ❌"}`);
	console.log(
		`SESSIONS STAMPED w/ org+person: ${sessionsStamped ? "PASS ✅" : "FAIL ❌"}`,
	);

	await pool.end();
	if (!twoProjects || !sessionsStamped) process.exit(1);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
