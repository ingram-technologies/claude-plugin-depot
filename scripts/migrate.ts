/**
 * Apply Drizzle migrations. Works against DATABASE_URL (DO Postgres in prod,
 * or a PGlite socket in dev). Also enables required extensions.
 */
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { db, execute, pool } from "../src/lib/db";

async function main() {
	// pg_trgm powers fuzzy candidate retrieval in the canonicalize stage.
	// Available on DO Postgres; may be absent under PGlite in dev — the
	// canonicalizer falls back to ILIKE matching, so don't fail the migration.
	try {
		await execute("create extension if not exists pg_trgm");
	} catch (err) {
		console.warn("pg_trgm unavailable, continuing without it:", err);
	}
	await migrate(db, { migrationsFolder: "./drizzle" });
	await pool.end();
	console.log("migrations applied");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
