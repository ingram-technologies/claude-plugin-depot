/**
 * Public surface of the read layer. Server Components import from here.
 */

export {
	corpusHealth,
	getProjectBySlug,
	listProjects,
	projectActivity,
} from "./projects";
export { feed, getEntry, listEntries, recentlyLearned, searchEntries } from "./entries";
export { latestBriefing } from "./briefings";
export {
	daysSince,
	freshnessBucket,
	isLiveEdge,
	isStale,
	relativeTime,
	shortAgo,
} from "./freshness";
export type {
	ActivityDay,
	BriefingView,
	CorpusHealth,
	EntryDetail,
	EntryStatus,
	EntrySummary,
	EntryType,
	EvidenceRow,
	FreshnessBucket,
	ProjectSummary,
	RelatedEntry,
} from "./types";
