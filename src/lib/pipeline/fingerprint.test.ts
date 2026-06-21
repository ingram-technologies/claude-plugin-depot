import { describe, expect, it } from "vitest";

import { claimFingerprint, normalizeClaimText } from "./fingerprint";

describe("normalizeClaimText", () => {
  it("lowercases, collapses whitespace, trims", () => {
    expect(normalizeClaimText("  We   Use\tDrizzle\nORM  ")).toBe("we use drizzle orm");
  });
});

describe("claimFingerprint", () => {
  const base = {
    projectId: "prj_1",
    claimType: "decision",
    claim: "We use Drizzle ORM",
    evidenceUuids: ["a", "b"],
  };

  it("is deterministic for identical input", () => {
    expect(claimFingerprint(base)).toBe(claimFingerprint(base));
  });

  it("is independent of evidence order", () => {
    const reordered = { ...base, evidenceUuids: ["b", "a"] };
    expect(claimFingerprint(base)).toBe(claimFingerprint(reordered));
  });

  it("is independent of duplicate evidence uuids", () => {
    const dup = { ...base, evidenceUuids: ["a", "b", "a", "b"] };
    expect(claimFingerprint(base)).toBe(claimFingerprint(dup));
  });

  it("ignores claim-text casing and whitespace (normalization)", () => {
    const messy = { ...base, claim: "  we   USE drizzle\torm " };
    expect(claimFingerprint(base)).toBe(claimFingerprint(messy));
  });

  it("ignores runId (idempotent across runs)", () => {
    expect(claimFingerprint({ ...base, runId: "run_x" })).toBe(
      claimFingerprint({ ...base, runId: "run_y" }),
    );
  });

  it("differs on project, type, claim, or evidence", () => {
    const fp = claimFingerprint(base);
    expect(claimFingerprint({ ...base, projectId: "prj_2" })).not.toBe(fp);
    expect(claimFingerprint({ ...base, claimType: "gotcha" })).not.toBe(fp);
    expect(claimFingerprint({ ...base, claim: "We use Prisma" })).not.toBe(fp);
    expect(claimFingerprint({ ...base, evidenceUuids: ["a", "c"] })).not.toBe(fp);
  });

  it("produces a 64-char hex sha256", () => {
    expect(claimFingerprint(base)).toMatch(/^[0-9a-f]{64}$/);
  });
});
