import { describe, expect, it } from "vitest";

import { basenameOf, localRemote, nextFreeSlug, slugify } from "./slug";

describe("basenameOf", () => {
  it("takes the repo name from a canonical remote", () => {
    expect(basenameOf("github.com/ingram-technologies/depot.ingram.tech")).toBe(
      "depot.ingram.tech",
    );
  });
  it("strips a trailing .git and slashes", () => {
    expect(basenameOf("github.com/org/repo.git")).toBe("repo");
    expect(basenameOf("/home/adys/src/depot/")).toBe("depot");
  });
  it("handles windows-style separators", () => {
    expect(basenameOf("C:\\src\\my-proj")).toBe("my-proj");
  });
});

describe("slugify", () => {
  it("lowercases and dashes non-alnum runs", () => {
    expect(slugify("depot.ingram.tech")).toBe("depot-ingram-tech");
    expect(slugify("My Cool Repo!!")).toBe("my-cool-repo");
  });
  it("never returns empty", () => {
    expect(slugify("///")).toBe("project");
    expect(slugify("")).toBe("project");
  });
});

describe("nextFreeSlug", () => {
  it("returns the stem when free", () => {
    expect(nextFreeSlug("depot", new Set())).toBe("depot");
  });
  it("appends the first free numeric suffix", () => {
    expect(nextFreeSlug("depot", new Set(["depot"]))).toBe("depot-2");
    expect(nextFreeSlug("depot", new Set(["depot", "depot-2"]))).toBe("depot-3");
  });
});

describe("localRemote", () => {
  it("is stable for the same machine + path (idempotent identity)", () => {
    const a = localRemote("fp-123", "/home/adys/src/x");
    const b = localRemote("fp-123", "/home/adys/src/x");
    expect(a).toBe(b);
    expect(a).toBe("local:fp-123:/home/adys/src/x");
  });
  it("differs per machine and per path", () => {
    expect(localRemote("fp-1", "/x")).not.toBe(localRemote("fp-2", "/x"));
    expect(localRemote("fp-1", "/x")).not.toBe(localRemote("fp-1", "/y"));
  });
});
