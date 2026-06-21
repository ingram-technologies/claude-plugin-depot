import { describe, expect, it } from "vitest";
import { buildTree, orderRecords, splitSidechains } from "./thread";
import type { NormalizedRecord } from "./types";

function rec(over: Partial<NormalizedRecord> & { uuid: string }): NormalizedRecord {
	return {
		uuid: over.uuid,
		parentUuid: over.parentUuid ?? null,
		providerSessionId: null,
		recordType: over.recordType ?? "user",
		subtype: null,
		isSidechain: over.isSidechain ?? false,
		isMeta: false,
		role: null,
		model: null,
		cwd: null,
		gitBranch: null,
		ts: over.ts ?? null,
		inputTokens: null,
		outputTokens: null,
		cacheReadTokens: null,
		textContent: null,
		toolName: null,
		raw: {},
	};
}

describe("orderRecords", () => {
	it("orders by ts then stable insertion order", () => {
		const a = rec({ uuid: "a", ts: new Date("2026-01-01T00:00:02Z") });
		const b = rec({ uuid: "b", ts: new Date("2026-01-01T00:00:01Z") });
		const c = rec({ uuid: "c", ts: null });
		const d = rec({ uuid: "d", ts: null });
		const out = orderRecords([a, b, c, d]).map((r) => r.uuid);
		expect(out).toEqual(["b", "a", "c", "d"]);
	});
});

describe("buildTree", () => {
	it("links children to parents and tolerates missing parents", () => {
		const root = rec({ uuid: "r" });
		const child = rec({ uuid: "c", parentUuid: "r" });
		const orphan = rec({ uuid: "o", parentUuid: "missing" });
		const { roots, byUuid } = buildTree([child, root, orphan]);

		expect(roots.map((n) => n.record.uuid).sort()).toEqual(["o", "r"]);
		expect(byUuid.get("r")?.children.map((n) => n.record.uuid)).toEqual(["c"]);
	});
});

describe("splitSidechains", () => {
	it("separates main from sidechain records", () => {
		const m1 = rec({ uuid: "m1" });
		const sc = rec({ uuid: "sc", isSidechain: true });
		const m2 = rec({ uuid: "m2" });
		const { main, sidechains } = splitSidechains([m1, sc, m2]);
		expect(main.map((r) => r.uuid)).toEqual(["m1", "m2"]);
		expect(sidechains.map((r) => r.uuid)).toEqual(["sc"]);
	});
});
