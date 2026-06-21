/**
 * Shared view-model types for the read layer. These are the shapes the UI
 * renders — distinct from the raw Drizzle row types.
 */

export type EntryType = "decision" | "gotcha" | "principle" | "state";
export type EntryStatus = "active" | "superseded" | "contested" | "retired";

export type FreshnessBucket = "fresh" | "aging" | "stale";

export type ProjectSummary = {
	id: string;
	slug: string;
	displayName: string;
	description: string | null;
	canonicalRemote: string;
	lastActivityAt: Date | null;
	entryCount: number;
	sessionCount: number;
	lastLearnedAt: Date | null;
};

export type EntrySummary = {
	id: string;
	projectId: string;
	projectSlug: string;
	entryType: EntryType;
	title: string;
	claim: string;
	confidence: number;
	sessionCount: number;
	status: EntryStatus;
	firstSeenAt: Date | null;
	lastSeenAt: Date | null;
	updatedAt: Date;
};

export type EvidenceRow = {
	id: string;
	recordUuid: string;
	quote: string | null;
	observedAt: Date | null;
	sessionId: string | null;
	sessionDate: Date | null;
	model: string | null;
	textContent: string | null;
};

export type RelatedEntry = {
	id: string;
	entryType: EntryType;
	title: string;
	claim: string;
};

export type EntryDetail = {
	id: string;
	projectId: string;
	projectSlug: string;
	projectName: string;
	entryType: EntryType;
	slug: string;
	title: string;
	claim: string;
	body: string | null;
	scope: string | null;
	status: EntryStatus;
	confidence: number;
	sessionCount: number;
	tags: string[];
	firstSeenAt: Date | null;
	lastSeenAt: Date | null;
	lastConfirmedAt: Date | null;
	updatedAt: Date;
	supersededById: string | null;
	evidence: EvidenceRow[];
	supersededBy: RelatedEntry | null;
	supersedes: RelatedEntry[];
	related: RelatedEntry[];
};

export type BriefingView = {
	id: string;
	content: string;
	stateOfMind: string | null;
	entryCountAtGen: number | null;
	createdAt: Date;
};

export type ActivityDay = {
	day: string; // YYYY-MM-DD
	count: number;
};

export type CorpusHealth = {
	fresh: number;
	aging: number;
	stale: number;
	total: number;
};
