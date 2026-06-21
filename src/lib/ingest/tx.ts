/**
 * A connection handle that is either the root `db` or a drizzle transaction.
 * Ingest resolvers accept this so each file's work runs in ONE transaction
 * while sharing one code path with non-transactional callers (defaults to db).
 */

import type { db } from "@/lib/db";

type TransactionCallback = Parameters<(typeof db)["transaction"]>[0];

/** The transactional handle drizzle hands to `db.transaction(async (tx) => …)`. */
export type Tx = Parameters<TransactionCallback>[0] | typeof db;
