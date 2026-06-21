/**
 * Dev smoke test: ingest a few REAL ~/.claude transcripts through the ingest
 * module against the local DB, twice, to prove idempotency + dedup. No IC needed.
 * Run: DATABASE_URL=… bunx tsx scripts/smoke-ingest.ts
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { count } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import { db, pool, schema } from "../src/lib/db";
import { ingestUpload } from "../src/lib/ingest";
import { issueIngestToken, verifyIngestToken } from "../src/lib/ingest/tokens";

function pickFiles(limit: number) {
	const root = join(homedir(), ".claude", "projects");
	const out: { path: string; size: number }[] = [];
	for (const dir of readdirSync(root)) {
		const dirPath = join(root, dir);
		if (!statSync(dirPath).isDirectory()) continue;
		for (const f of readdirSync(dirPath)) {
			if (!f.endsWith(".jsonl")) continue;
			const p = join(dirPath, f);
			const size = statSync(p).size;
			if (size > 0 && size < 600_000) out.push({ path: p, size });
		}
	}
	// smallest non-empty files keep the test fast
	return out.sort((a, b) => a.size - b.size).slice(0, limit);
}

function fileToPayloadFile(path: string) {
	const bytes = readFileSync(path);
	const text = bytes.toString("utf8");
	const records: unknown[] = [];
	let cwd: string | undefined;
	let gitBranch: string | undefined;
	for (const line of text.split("\n")) {
		const t = line.trim();
		if (!t) continue;
		try {
			const rec = JSON.parse(t) as Record<string, unknown>;
			records.push(rec);
			if (typeof rec.cwd === "string") cwd = rec.cwd;
			if (typeof rec.gitBranch === "string") gitBranch = rec.gitBranch;
		} catch {
			// skip malformed line
		}
	}
	const providerSessionId = path.split("/").pop()?.replace(".jsonl", "") ?? path;
	return {
		providerSessionId,
		projectPathAbs: cwd ?? "/unknown",
		gitBranch,
		sha256: createHash("sha256").update(bytes).digest("hex"),
		records,
	};
}

async function tableCount(table: PgTable) {
	const [row] = await db.select({ n: count() }).from(table);
	return row?.n ?? 0;
}

async function main() {
	const files = pickFiles(3);
	console.log(`picked ${files.length} real transcript files`);

	const { token } = await issueIngestToken({ label: "smoke-test" });
	const auth = await verifyIngestToken(token);
	if (!auth) throw new Error("token verify failed");

	const payload = {
		machine: { fingerprint: "smoke-machine-1", hostname: "smoke", os: "linux" },
		account: { vendor: "anthropic" as const, vendorAccountId: "smoke-account-1" },
		files: files.map((f) => fileToPayloadFile(f.path)),
	};

	console.log("\n--- first ingest ---");
	const r1 = await ingestUpload(payload, auth);
	console.log(JSON.stringify(r1, null, 2));

	console.log("\n--- second ingest (must be a no-op: dedup) ---");
	const r2 = await ingestUpload(payload, auth);
	console.log(JSON.stringify(r2, null, 2));

	console.log("\n--- table counts ---");
	for (const [name, table] of [
		["project", schema.project],
		["project_path", schema.projectPath],
		["machine", schema.machine],
		["account", schema.account],
		["session", schema.session],
		["transcript_record", schema.transcriptRecord],
		["transcript_file", schema.transcriptFile],
	] as const) {
		console.log(`${name}: ${await tableCount(table)}`);
	}

	const ok = r2.records.inserted === 0 && r1.records.inserted > 0;
	console.log(`\nIDEMPOTENT + INGESTED REAL DATA: ${ok ? "PASS ✅" : "FAIL ❌"}`);
	await pool.end();
	if (!ok) process.exit(1);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
