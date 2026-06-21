/**
 * The insights pipeline: transcripts → cited Memories.
 *   extract (per session) → canonicalize (per project) → brief (per project)
 */

export { claimFingerprint, normalizeClaimText } from "./fingerprint";
export type { FingerprintInput } from "./fingerprint";
export { computeConfidence, HALF_LIFE_DAYS, RECENCY_FLOOR } from "./confidence";
export type { ConfidenceInput } from "./confidence";
export { extractSession } from "./extract";
export type { ExtractStats } from "./extract";
export { canonicalizeProject } from "./canonicalize";
export type { CanonicalizeStats } from "./canonicalize";
export { generateBriefing } from "./brief";
export type { BriefStats } from "./brief";
export {
	runProjectPipeline,
	runAllStaleProjects,
	staleSessionsForProject,
} from "./run";
export type { ProjectPipelineResult } from "./run";
export * as schemas from "./schemas";
