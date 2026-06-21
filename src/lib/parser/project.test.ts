import { describe, expect, it } from "vitest";
import { decodeProjectDir, normalizeGitRemote } from "./project";

describe("normalizeGitRemote", () => {
	it("canonicalizes scp-style ssh remotes", () => {
		expect(normalizeGitRemote("git@github.com:org/repo.git")).toBe(
			"github.com/org/repo",
		);
	});

	it("canonicalizes https remotes and strips .git + creds", () => {
		expect(normalizeGitRemote("https://github.com/Org/Repo.git")).toBe(
			"github.com/Org/Repo",
		);
		expect(normalizeGitRemote("https://user:token@github.com/org/repo.git")).toBe(
			"github.com/org/repo",
		);
	});

	it("canonicalizes ssh:// remotes and drops the port", () => {
		expect(normalizeGitRemote("ssh://git@github.com:22/org/repo.git")).toBe(
			"github.com/org/repo",
		);
	});

	it("lowercases the host but preserves the path case", () => {
		expect(normalizeGitRemote("git@GitHub.com:Org/Repo")).toBe(
			"github.com/Org/Repo",
		);
	});

	it("handles git:// protocol", () => {
		expect(normalizeGitRemote("git://gitlab.com/group/sub/repo.git")).toBe(
			"gitlab.com/group/sub/repo",
		);
	});

	it("returns empty for unparseable or missing remotes", () => {
		expect(normalizeGitRemote("")).toBe("");
		expect(normalizeGitRemote("   ")).toBe("");
		expect(normalizeGitRemote("not a remote")).toBe("");
	});
});

describe("decodeProjectDir", () => {
	it("decodes a standard encoded path", () => {
		expect(decodeProjectDir("-home-adys-src-depot-ingram-tech")).toBe(
			"/home/adys/src/depot/ingram/tech",
		);
	});

	it("handles a name without the leading dash", () => {
		expect(decodeProjectDir("home-adys")).toBe("/home/adys");
	});

	it("returns empty string for empty input", () => {
		expect(decodeProjectDir("")).toBe("");
	});
});
