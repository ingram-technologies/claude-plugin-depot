import { describe, expect, it } from "vitest";

import { gateRecordsByRemote } from "./scan.ts";

const remoteOf = (cwd: string): string | undefined =>
	({
		"/repo-a": "git@github.com:acme/a.git",
		"/repo-b": "https://github.com/acme/b",
	})[cwd];

describe("gateRecordsByRemote", () => {
	it("keeps records per their OWN cwd and reports every remote seen", () => {
		const records = [
			{ uuid: "1", cwd: "/repo-a" },
			{ uuid: "2", cwd: "/repo-b" },
			{ uuid: "3", cwd: "/repo-a" },
		];
		const out = gateRecordsByRemote(records, "/repo-a", remoteOf);
		expect(out.kept).toHaveLength(3);
		expect(out.dropped).toBe(0);
		expect(out.remotes).toEqual({
			"/repo-a": "git@github.com:acme/a.git",
			"/repo-b": "https://github.com/acme/b",
		});
	});

	it("drops records in a remote-less directory — and only those", () => {
		const records = [
			{ uuid: "1", cwd: "/repo-a" },
			{ uuid: "2", cwd: "/private" },
			{ uuid: "3", cwd: "/repo-a" },
		];
		const out = gateRecordsByRemote(records, "/repo-a", remoteOf);
		expect(out.kept.map((r) => (r as { uuid: string }).uuid)).toEqual(["1", "3"]);
		expect(out.dropped).toBe(1);
		expect(out.remotes).toEqual({ "/repo-a": "git@github.com:acme/a.git" });
	});

	it("a record without a cwd sits where the previous one did, else at the start", () => {
		const records = [
			{ uuid: "1" }, // → default (/repo-a)
			{ uuid: "2", cwd: "/private" },
			{ uuid: "3" }, // → inherits /private → dropped
			{ uuid: "4", cwd: "/repo-b" },
			{ uuid: "5" }, // → inherits /repo-b
		];
		const out = gateRecordsByRemote(records, "/repo-a", remoteOf);
		expect(out.kept.map((r) => (r as { uuid: string }).uuid)).toEqual([
			"1",
			"4",
			"5",
		]);
		expect(out.dropped).toBe(2);
	});

	it("resolves each directory's remote exactly once", () => {
		const calls: string[] = [];
		const records = Array.from({ length: 6 }, (_, i) => ({
			uuid: String(i),
			cwd: i % 2 === 0 ? "/repo-a" : "/repo-b",
		}));
		gateRecordsByRemote(records, "/repo-a", (cwd) => {
			calls.push(cwd);
			return remoteOf(cwd);
		});
		expect(calls).toEqual(["/repo-a", "/repo-b"]);
	});

	it("a session that starts in a private folder and never leaves keeps nothing", () => {
		const out = gateRecordsByRemote(
			[{ uuid: "1", cwd: "/private" }, { uuid: "2" }],
			"/private",
			remoteOf,
		);
		expect(out.kept).toHaveLength(0);
		expect(out.dropped).toBe(2);
		expect(out.remotes).toEqual({});
	});
});
