/**
 * Confidence is DERIVED, never authored (ARCHITECTURE: "function of # independent
 * sessions, recency, contradiction"). It's shown to humans as "seen in N sessions
 * over M months", so the number must be transparent and monotonic in the things
 * people actually trust.
 *
 * Formula (documented so it can be re-tuned without re-invoking the LLM):
 *
 *   support  = min(1, log2(1 + sessions) / 3)
 *   recency  = 0.5 ^ (ageDays / HALF_LIFE_DAYS)
 *   confidence = support * (RECENCY_FLOOR + (1 - RECENCY_FLOOR) * recency)
 *
 * - `support` saturates: 1 session → 0.33, 3 → 0.67, 7 → 1.0. Diminishing
 *   returns mean a lesson seen in many sessions can't run away from a freshly
 *   re-confirmed one.
 * - `recency` halves every HALF_LIFE_DAYS since `lastSeenAt`, so stale memories
 *   visibly fade.
 * - `RECENCY_FLOOR` keeps an old-but-heavily-supported memory from decaying to
 *   zero — recency discounts, it doesn't erase. confidence stays in [0, 1].
 *
 * Contradiction is handled structurally (a superseded entry is set to status
 * 'superseded'), so it doesn't enter this scalar.
 */

export const HALF_LIFE_DAYS = 120;
export const RECENCY_FLOOR = 0.35;
const SUPPORT_DIVISOR = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ConfidenceInput = {
  /** Number of DISTINCT sessions the entry's evidence spans. */
  sessionCount: number;
  /** Most recent evidence timestamp; null/undefined → treated as `now`. */
  lastSeenAt?: Date | null;
  /** Reference "now" (injectable for deterministic tests). */
  now?: Date;
};

export function computeConfidence(input: ConfidenceInput): number {
  const sessions = Math.max(0, input.sessionCount);
  const support = Math.min(1, Math.log2(1 + sessions) / SUPPORT_DIVISOR);

  const now = input.now ?? new Date();
  const last = input.lastSeenAt ?? now;
  const ageDays = Math.max(0, (now.getTime() - last.getTime()) / DAY_MS);
  const recency = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
  const recencyFactor = RECENCY_FLOOR + (1 - RECENCY_FLOOR) * recency;

  const confidence = support * recencyFactor;
  // Clamp defensively against fp drift.
  return Math.max(0, Math.min(1, confidence));
}
