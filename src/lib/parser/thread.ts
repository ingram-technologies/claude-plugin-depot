/**
 * Pure helpers over a set of normalized records: build the parent/child tree,
 * order records deterministically, and separate the main conversation from
 * subagent sidechains. Records arrive out of order and may reference missing
 * parents, so every helper tolerates a partial set.
 */

import type { NormalizedRecord } from "./types";

export type TreeNode = {
	record: NormalizedRecord;
	children: TreeNode[];
};

export type Tree = {
	/** Roots: records whose parentUuid is null or points outside this set. */
	roots: TreeNode[];
	/** Every node keyed by uuid, for O(1) lookup. */
	byUuid: Map<string, TreeNode>;
};

/**
 * Build a parent→children adjacency tree. A record whose `parentUuid` is null
 * or unknown becomes a root, so no record is ever dropped. Child order follows
 * {@link orderRecords}.
 */
export function buildTree(records: NormalizedRecord[]): Tree {
	const byUuid = new Map<string, TreeNode>();
	for (const record of records) {
		byUuid.set(record.uuid, { record, children: [] });
	}

	const roots: TreeNode[] = [];
	for (const record of orderRecords(records)) {
		const node = byUuid.get(record.uuid);
		if (!node) continue;
		const parentUuid = record.parentUuid;
		const parent = parentUuid ? byUuid.get(parentUuid) : undefined;
		if (parent) {
			parent.children.push(node);
		} else {
			roots.push(node);
		}
	}

	return { roots, byUuid };
}

/**
 * Stable ordering: primarily by `ts` ascending, with original array position as
 * the tie-breaker (and the sole key when timestamps are missing/equal). This
 * mirrors the `(ts, seq)` ordering the record table indexes on.
 */
export function orderRecords(records: NormalizedRecord[]): NormalizedRecord[] {
	return records
		.map((record, index) => ({ record, index }))
		.sort((a, b) => {
			const ta = a.record.ts ? a.record.ts.getTime() : null;
			const tb = b.record.ts ? b.record.ts.getTime() : null;
			if (ta !== null && tb !== null && ta !== tb) return ta - tb;
			// One side missing a ts, or equal ts: fall back to insertion order.
			return a.index - b.index;
		})
		.map((entry) => entry.record);
}

export type SplitResult = {
	main: NormalizedRecord[];
	sidechains: NormalizedRecord[];
};

/**
 * Partition into the main conversation and subagent sidechains, each preserving
 * {@link orderRecords} ordering.
 */
export function splitSidechains(records: NormalizedRecord[]): SplitResult {
	const main: NormalizedRecord[] = [];
	const sidechains: NormalizedRecord[] = [];
	for (const record of orderRecords(records)) {
		if (record.isSidechain) {
			sidechains.push(record);
		} else {
			main.push(record);
		}
	}
	return { main, sidechains };
}
