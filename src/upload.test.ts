import { describe, expect, it } from "vitest";

import { chunkPrepared, prepareRecords, shedLargeStrings } from "./upload.ts";

const REQUEST_BUDGET = 3_500_000;

describe("shedLargeStrings", () => {
	it("returns the same reference when nothing exceeds the cap", () => {
		const value = { a: "short", b: ["also short", { c: "fine" }] };
		expect(shedLargeStrings(value, 1000)).toBe(value);
	});

	it("truncates an over-cap string and marks the shed byte count", () => {
		const big = "x".repeat(5000);
		const out = shedLargeStrings(big, 1000) as string;
		expect(out.startsWith("x".repeat(1000))).toBe(true);
		expect(out).toContain("<truncated 4000 bytes>");
	});

	it("sheds deep into nested arrays/objects, copying only changed branches", () => {
		const shared = { keep: "small" };
		const value = { nested: { huge: "y".repeat(4000) }, sibling: shared };
		const out = shedLargeStrings(value, 1000) as {
			nested: { huge: string };
			sibling: typeof shared;
		};
		expect(out.nested.huge).toContain("<truncated");
		// untouched branch keeps its reference (no needless copy)
		expect(out.sibling).toBe(shared);
	});
});

describe("prepareRecords", () => {
	it("leaves normal records untouched, by reference", () => {
		const records = [{ uuid: "a", text: "hello" }, { uuid: "b" }];
		const { prepared, truncated } = prepareRecords(records);
		expect(truncated).toBe(0);
		expect(prepared[0].record).toBe(records[0]);
		expect(prepared[0].truncated).toBe(false);
		expect(prepared[0].bytes).toBeGreaterThan(0);
	});

	it("sheds a single record larger than the per-record budget under the request budget", () => {
		// One record with a 4 MB string — bigger than a whole request can carry.
		const monster = { uuid: "big", blob: "z".repeat(4_000_000) };
		const { prepared, truncated } = prepareRecords([monster]);
		expect(truncated).toBe(1);
		expect(prepared[0].truncated).toBe(true);
		// After shedding, the record fits comfortably inside one request.
		expect(prepared[0].bytes).toBeLessThan(REQUEST_BUDGET);
	});

	it("falls back to the small cap when one record holds many large strings", () => {
		// 40 strings × ~128 KB ≈ 5 MB — over budget even after the 128 KB pass.
		const fields: Record<string, string> = { uuid: "many" };
		for (let i = 0; i < 40; i++) {
			fields[`f${i}`] = "q".repeat(130_000);
		}
		const { prepared } = prepareRecords([fields]);
		expect(prepared[0].bytes).toBeLessThan(REQUEST_BUDGET);
	});
});

describe("chunkPrepared", () => {
	it("keeps everything in one chunk when it fits", () => {
		const { prepared } = prepareRecords([{ a: 1 }, { b: 2 }, { c: 3 }]);
		expect(chunkPrepared(prepared, 1000)).toHaveLength(1);
	});

	it("splits by record-count cap", () => {
		const { prepared } = prepareRecords(
			Array.from({ length: 10 }, (_, i) => ({ i })),
		);
		const chunks = chunkPrepared(prepared, 3);
		expect(chunks).toHaveLength(4); // 3 + 3 + 3 + 1
		expect(chunks[0]).toHaveLength(3);
		expect(chunks[3]).toHaveLength(1);
	});

	it("splits by byte budget when records are large", () => {
		// Each record ~1.5 MB → at most 2 fit under the 3.5 MB request budget.
		const records = Array.from({ length: 5 }, (_, i) => ({
			i,
			blob: "w".repeat(1_500_000),
		}));
		const { prepared } = prepareRecords(records);
		const chunks = chunkPrepared(prepared, 1000);
		expect(chunks.length).toBeGreaterThan(1);
		// No chunk's serialized records exceed the request budget.
		for (const chunk of chunks) {
			const bytes = Buffer.byteLength(JSON.stringify(chunk), "utf8");
			expect(bytes).toBeLessThanOrEqual(REQUEST_BUDGET + 1000);
		}
	});

	it("preserves total record count and order across chunks", () => {
		const records = Array.from({ length: 7 }, (_, i) => ({ i }));
		const { prepared } = prepareRecords(records);
		const flat = chunkPrepared(prepared, 2).flat() as { i: number }[];
		expect(flat.map((r) => r.i)).toEqual([0, 1, 2, 3, 4, 5, 6]);
	});

	it("returns no chunks for an empty input", () => {
		expect(chunkPrepared([], 1000)).toEqual([]);
	});
});
