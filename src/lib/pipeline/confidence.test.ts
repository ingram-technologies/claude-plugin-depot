import { describe, expect, it } from "vitest";

import { computeConfidence, HALF_LIFE_DAYS, RECENCY_FLOOR } from "./confidence";

const NOW = new Date("2026-06-21T00:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

describe("computeConfidence", () => {
	it("returns 0 with no sessions", () => {
		expect(computeConfidence({ sessionCount: 0, lastSeenAt: NOW, now: NOW })).toBe(
			0,
		);
	});

	it("stays within [0, 1]", () => {
		for (const n of [0, 1, 3, 7, 50]) {
			for (const age of [0, 30, 120, 400]) {
				const c = computeConfidence({
					sessionCount: n,
					lastSeenAt: daysAgo(age),
					now: NOW,
				});
				expect(c).toBeGreaterThanOrEqual(0);
				expect(c).toBeLessThanOrEqual(1);
			}
		}
	});

	it("rises with session count (more receipts = more trust)", () => {
		const c1 = computeConfidence({ sessionCount: 1, lastSeenAt: NOW, now: NOW });
		const c3 = computeConfidence({ sessionCount: 3, lastSeenAt: NOW, now: NOW });
		const c7 = computeConfidence({ sessionCount: 7, lastSeenAt: NOW, now: NOW });
		expect(c3).toBeGreaterThan(c1);
		expect(c7).toBeGreaterThan(c3);
	});

	it("saturates support: ~7 sessions reaches the fresh ceiling of 1", () => {
		const c7 = computeConfidence({ sessionCount: 7, lastSeenAt: NOW, now: NOW });
		expect(c7).toBeCloseTo(1, 5);
	});

	it("decays with age, never below the recency floor of fresh value", () => {
		const fresh = computeConfidence({
			sessionCount: 7,
			lastSeenAt: NOW,
			now: NOW,
		});
		const aged = computeConfidence({
			sessionCount: 7,
			lastSeenAt: daysAgo(HALF_LIFE_DAYS),
			now: NOW,
		});
		// One half-life: recency 0.5 → factor = FLOOR + (1-FLOOR)*0.5.
		expect(aged).toBeLessThan(fresh);
		expect(aged).toBeCloseTo(
			fresh * (RECENCY_FLOOR + (1 - RECENCY_FLOOR) * 0.5),
			5,
		);
	});

	it("never decays below support * RECENCY_FLOOR even when ancient", () => {
		const ancient = computeConfidence({
			sessionCount: 7,
			lastSeenAt: daysAgo(10_000),
			now: NOW,
		});
		expect(ancient).toBeGreaterThanOrEqual(RECENCY_FLOOR - 1e-9);
	});

	it("treats missing lastSeenAt as fresh (now)", () => {
		const a = computeConfidence({ sessionCount: 3, lastSeenAt: null, now: NOW });
		const b = computeConfidence({ sessionCount: 3, lastSeenAt: NOW, now: NOW });
		expect(a).toBeCloseTo(b, 9);
	});
});
