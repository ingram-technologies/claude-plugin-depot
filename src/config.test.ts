import { afterEach, describe, expect, it } from "vitest";

import { allowedRemote } from "./config.ts";

describe("allowedRemote", () => {
	afterEach(() => {
		delete process.env.DEPOT_REMOTES;
	});

	it("passes every remote when DEPOT_REMOTES is unset", () => {
		expect(allowedRemote("git@github.com:acme/a.git")).toBe("git@github.com:acme/a.git");
		expect(allowedRemote(null)).toBeUndefined();
	});

	it("keeps only remotes matching a listed substring", () => {
		process.env.DEPOT_REMOTES = "acme/, other/repo-b ";
		expect(allowedRemote("https://github.com/acme/a")).toBe("https://github.com/acme/a");
		expect(allowedRemote("git@github.com:other/repo-b.git")).toBe(
			"git@github.com:other/repo-b.git",
		);
		expect(allowedRemote("https://github.com/other/repo-c")).toBeUndefined();
	});
});
