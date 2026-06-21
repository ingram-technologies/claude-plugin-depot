/**
 * Public API of the transcript parser. Everything here is pure — it operates on
 * strings and plain objects, never on fs or the database.
 */

export type { NormalizedRecord, RawRecord } from "./types";
export { normalizeRecord } from "./normalize";
export { parseTranscript } from "./parse";
export type { ParseError, ParseResult } from "./parse";
export { decodeProjectDir, normalizeGitRemote } from "./project";
export { buildTree, orderRecords, splitSidechains } from "./thread";
export type { SplitResult, Tree, TreeNode } from "./thread";
