/**
 * Zod schemas for every piece of LLM output in the pipeline. External/model
 * output is ALWAYS validated through these — never `as`-cast.
 */

import { z } from "zod";

export const CLAIM_TYPES = ["decision", "gotcha", "principle", "state"] as const;
export const ClaimType = z.enum(CLAIM_TYPES);
export type ClaimTypeT = z.infer<typeof ClaimType>;

// ── Extractor output ─────────────────────────────────────────────────────────

// IC doesn't enforce json_schema, so models free-form the keys. Normalize the
// common spellings (recordUuid / record_uuid / uuid / id) before validation.
const evidenceShape = z.preprocess(
	(raw) => {
		if (typeof raw === "string") return { recordUuid: raw };
		if (raw && typeof raw === "object") {
			const r = raw as Record<string, unknown>;
			const uuid = r.recordUuid ?? r.record_uuid ?? r.uuid ?? r.id ?? r.record;
			return { recordUuid: uuid, quote: r.quote ?? r.text ?? r.excerpt };
		}
		return raw;
	},
	z.object({
		recordUuid: z.coerce.string().min(1),
		quote: z.string().max(400).optional(),
	}),
);

export const ClaimEvidence = evidenceShape;
export type ClaimEvidenceT = z.infer<typeof ClaimEvidence>;

// Tolerate evidence entries the model malformed: keep only valid ones. A claim
// with zero valid evidence is dropped downstream (provenance is mandatory).
const lenientEvidenceArray = z
	.array(z.unknown())
	.default([])
	.transform((arr) =>
		arr
			.map((e) => evidenceShape.safeParse(e))
			.filter((r) => r.success)
			.map((r) => r.data),
	);

export const ExtractedClaim = z.object({
	claimType: ClaimType,
	claim: z.string().min(1).max(400),
	body: z.string().max(2_000).optional().default(""),
	scope: z.string().max(200).optional().default(""),
	evidence: lenientEvidenceArray,
});
export type ExtractedClaim = z.infer<typeof ExtractedClaim>;

export const ExtractionResult = z.object({
	// Drop individual malformed claims instead of failing the whole extraction.
	claims: z
		.array(z.unknown())
		.default([])
		.transform((arr) =>
			arr
				.map((c) => ExtractedClaim.safeParse(c))
				.filter((r) => r.success)
				.map((r) => r.data)
				.slice(0, 12),
		),
});
export type ExtractionResultT = z.infer<typeof ExtractionResult>;

// ── Canonicalizer output ─────────────────────────────────────────────────────

export const CanonicalDecisionKind = z.enum(["new", "merge", "supersede"]);

export const CanonicalContent = z.object({
	title: z.string().min(1).max(120),
	claim: z.string().min(1).max(400),
	body: z.string().max(2_000).optional().default(""),
	scope: z.string().max(200).optional().default(""),
});
export type CanonicalContentT = z.infer<typeof CanonicalContent>;

export const CanonicalDecision = z.object({
	// IC doesn't enforce json_schema; tolerate omissions and fall back in code.
	decision: CanonicalDecisionKind.catch("new"),
	/** For merge: the entry to merge INTO. For supersede: the OLD entry replaced.
	 *  For new: null. Must be one of the candidate ids the caller provided. */
	targetEntryId: z.coerce.string().nullish(),
	/** Canonical content for the entry going forward; filled from the claim when
	 *  the model omits fields. */
	content: z
		.object({
			title: z.string().optional(),
			claim: z.string().optional(),
			body: z.string().optional(),
			scope: z.string().optional(),
		})
		.partial()
		.optional(),
});
export type CanonicalDecisionT = z.infer<typeof CanonicalDecision>;

// ── Briefer output ───────────────────────────────────────────────────────────

export const BriefingResult = z.preprocess(
	(raw) => {
		if (typeof raw === "string") return { content: raw, stateOfMind: "" };
		if (raw && typeof raw === "object") {
			const r = raw as Record<string, unknown>;
			return {
				content: r.content ?? r.briefing ?? r.markdown ?? r.text ?? r.body,
				stateOfMind:
					r.stateOfMind ?? r.state_of_mind ?? r.state ?? r.summary ?? "",
			};
		}
		return raw;
	},
	z.object({
		content: z.coerce.string().min(1),
		stateOfMind: z.coerce.string().max(500).default(""),
	}),
);
export type BriefingResultT = z.infer<typeof BriefingResult>;
