import { createDb, createPool, createQueries } from "@ingram-tech/nk-db";

import * as schema from "./schema";

/** One TLS-aware pg.Pool for the whole app (Better Auth + queries share it). */
export const pool = createPool();

export const db = createDb(pool, schema);

export const { query, one, maybeOne, execute, withTx } = createQueries(pool);

export type Db = typeof db;
export { schema };
