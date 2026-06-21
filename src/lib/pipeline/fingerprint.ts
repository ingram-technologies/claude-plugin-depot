/**
 * Deterministic claim fingerprint — the dedup key for `knowledge_claim`.
 *
 * Per ARCHITECTURE: re-running extraction must be idempotent. The same claim,
 * derived from the same evidence in the same project, must hash to the same value
 * across runs so `ON CONFLICT (fingerprint) DO NOTHING` inserts nothing new.
 *
 * Therefore the fingerprint deliberately EXCLUDES the run id and any
 * timestamps/ids. It is a pure function of:
 *   projectId | claimType | normalized claim text | sorted evidence uuids
 */

import { createHash } from "node:crypto";

export type FingerprintInput = {
	/** Accepted for call-site symmetry; intentionally NOT part of the hash. */
	runId?: string;
	projectId: string;
	claimType: string;
	claim: string;
	evidenceUuids: string[];
};

/** Lowercase, collapse all whitespace runs to a single space, trim. */
export function normalizeClaimText(claim: string): string {
	return claim.toLowerCase().replace(/\s+/g, " ").trim();
}

export function claimFingerprint(input: FingerprintInput): string {
	const claim = normalizeClaimText(input.claim);
	// De-dup + sort evidence so order and repeats can't change the hash.
	const evidence = Array.from(new Set(input.evidenceUuids)).sort();
	const material = [
		input.projectId,
		input.claimType.toLowerCase().trim(),
		claim,
		evidence.join(","),
	].join("|");
	return createHash("sha256").update(material).digest("hex");
}
