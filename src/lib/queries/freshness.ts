/**
 * Freshness + confidence are *derived trust signals*, never authored. A Memory
 * fades as it ages and as its confidence drops; one human confirm can keep it
 * lit. These helpers map raw values → the confidence palette buckets used
 * everywhere in the UI (sage / gold / terracotta).
 */

import type { FreshnessBucket } from "./types";

const DAY = 1000 * 60 * 60 * 24;

export function daysSince(date: Date | null): number | null {
	if (!date) {
		return null;
	}
	return Math.floor((Date.now() - date.getTime()) / DAY);
}

/**
 * Bucket by a blend of recency and confidence — both must hold for "fresh".
 * Fresh: seen recently AND well-supported. Stale: old or thinly-supported.
 */
export function freshnessBucket(
	lastSeenAt: Date | null,
	confidence: number,
): FreshnessBucket {
	const age = daysSince(lastSeenAt);
	if (age === null) {
		return "stale";
	}
	if (age <= 21 && confidence >= 0.6) {
		return "fresh";
	}
	if (age <= 90 && confidence >= 0.35) {
		return "aging";
	}
	return "stale";
}

export function isStale(lastSeenAt: Date | null, confidence: number): boolean {
	return freshnessBucket(lastSeenAt, confidence) === "stale";
}

/** "recently learned" = updated within the live-edge window. */
export function isLiveEdge(updatedAt: Date | null): boolean {
	const age = daysSince(updatedAt);
	return age !== null && age <= 3;
}

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function relativeTime(date: Date | null): string {
	const age = daysSince(date);
	if (age === null) {
		return "never";
	}
	if (age === 0) {
		return "today";
	}
	if (age < 30) {
		return RELATIVE.format(-age, "day");
	}
	if (age < 365) {
		return RELATIVE.format(-Math.round(age / 30), "month");
	}
	return RELATIVE.format(-Math.round(age / 365), "year");
}

/** A terse "6d ago" style stamp for dense mono freshness lines. */
export function shortAgo(date: Date | null): string {
	const age = daysSince(date);
	if (age === null) {
		return "—";
	}
	if (age === 0) {
		return "today";
	}
	if (age < 30) {
		return `${age}d ago`;
	}
	if (age < 365) {
		return `${Math.round(age / 30)}mo ago`;
	}
	return `${Math.round(age / 365)}y ago`;
}
