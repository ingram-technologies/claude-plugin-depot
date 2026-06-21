import { describe, expect, it } from "vitest";

import { findForkPoint, type ForkCandidate } from "./fork";

describe("findForkPoint", () => {
  const own = new Set(["a", "b", "c"]);

  it("returns null for a self-contained session", () => {
    const candidates: ForkCandidate[] = [
      { uuid: "a", parentUuid: null },
      { uuid: "b", parentUuid: "a" },
      { uuid: "c", parentUuid: "b" },
    ];
    expect(findForkPoint(own, candidates, () => undefined)).toBeNull();
  });

  it("detects a fork at the earliest external parent owned by another session", () => {
    const candidates: ForkCandidate[] = [
      { uuid: "a", parentUuid: "p1" }, // p1 belongs to ses_old
      { uuid: "b", parentUuid: "a" },
      { uuid: "c", parentUuid: "b" },
    ];
    const owners = new Map([["p1", "ses_old"]]);
    expect(findForkPoint(own, candidates, (u) => owners.get(u))).toEqual({
      forkedFromSessionId: "ses_old",
      forkPointRecordUuid: "p1",
    });
  });

  it("ignores external parents that are not yet in the DB", () => {
    const candidates: ForkCandidate[] = [
      { uuid: "a", parentUuid: "ghost" },
      { uuid: "b", parentUuid: "a" },
    ];
    expect(findForkPoint(own, candidates, () => undefined)).toBeNull();
  });

  it("picks the first external edge in seq order", () => {
    const candidates: ForkCandidate[] = [
      { uuid: "a", parentUuid: null },
      { uuid: "b", parentUuid: "px" },
      { uuid: "c", parentUuid: "py" },
    ];
    const owners = new Map([
      ["px", "ses_1"],
      ["py", "ses_2"],
    ]);
    expect(findForkPoint(own, candidates, (u) => owners.get(u))).toEqual({
      forkedFromSessionId: "ses_1",
      forkPointRecordUuid: "px",
    });
  });

  it("does not treat internal edges as forks", () => {
    const candidates: ForkCandidate[] = [{ uuid: "b", parentUuid: "a" }];
    // `a` is in own set → internal, even if a lookup would return something.
    expect(findForkPoint(own, candidates, () => "ses_other")).toBeNull();
  });
});
