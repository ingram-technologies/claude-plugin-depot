/**
 * Zod schemas for every piece of LLM output in the pipeline. External/model
 * output is ALWAYS validated through these — never `as`-cast.
 */

import { z } from "zod";

export const CLAIM_TYPES = ["decision", "gotcha", "principle", "state"] as const;
export const ClaimType = z.enum(CLAIM_TYPES);
export type ClaimTypeT = z.infer<typeof ClaimType>;

// ── Extractor output ─────────────────────────────────────────────────────────

export const ClaimEvidence = z.object({
  recordUuid: z.string().min(1),
  quote: z.string().max(400).optional(),
});
export type ClaimEvidenceT = z.infer<typeof ClaimEvidence>;

export const ExtractedClaim = z.object({
  claimType: ClaimType,
  claim: z.string().min(1).max(400),
  body: z.string().max(2_000).optional().default(""),
  scope: z.string().max(200).optional().default(""),
  evidence: z.array(ClaimEvidence).min(1).max(5),
});
export type ExtractedClaim = z.infer<typeof ExtractedClaim>;

export const ExtractionResult = z.object({
  claims: z.array(ExtractedClaim).max(12).default([]),
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
  decision: CanonicalDecisionKind,
  /** For merge: the entry to merge INTO. For supersede: the OLD entry replaced.
   *  For new: null. Must be one of the candidate ids the caller provided. */
  targetEntryId: z.string().nullable().default(null),
  /** Canonical content for the entry going forward (new/merge/supersede). */
  content: CanonicalContent,
});
export type CanonicalDecisionT = z.infer<typeof CanonicalDecision>;

// ── Briefer output ───────────────────────────────────────────────────────────

export const BriefingResult = z.object({
  content: z.string().min(1),
  stateOfMind: z.string().min(1).max(500),
});
export type BriefingResultT = z.infer<typeof BriefingResult>;
