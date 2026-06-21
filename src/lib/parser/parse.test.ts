import { describe, expect, it } from "vitest";
import { parseTranscript } from "./parse";

describe("parseTranscript", () => {
	it("parses good lines and collects malformed ones", () => {
		const text = [
			JSON.stringify({ uuid: "a", type: "user", message: { content: "hi" } }),
			"{not valid json",
			"",
			"   ",
			JSON.stringify({ uuid: "b", type: "assistant", message: {} }),
		].join("\n");

		const { records, errors } = parseTranscript(text);
		expect(records.map((r) => r.uuid)).toEqual(["a", "b"]);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.line).toBe(2);
	});

	it("reports records that lack a usable uuid", () => {
		const text = JSON.stringify({ type: "mode", mode: "default" });
		const { records, errors } = parseTranscript(text);
		expect(records).toHaveLength(0);
		expect(errors[0]?.message).toContain("uuid");
	});

	it("tolerates a trailing partial line", () => {
		const good = JSON.stringify({ uuid: "a", type: "user" });
		const { records, errors } = parseTranscript(`${good}\n{"uuid":"b",`);
		expect(records).toHaveLength(1);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.line).toBe(2);
	});

	it("handles CRLF line endings", () => {
		const text = [
			JSON.stringify({ uuid: "a", type: "user" }),
			JSON.stringify({ uuid: "b", type: "user" }),
		].join("\r\n");
		const { records } = parseTranscript(text);
		expect(records.map((r) => r.uuid)).toEqual(["a", "b"]);
	});

	it("tolerates very large lines", () => {
		const big = "x".repeat(1_000_000);
		const text = JSON.stringify({
			uuid: "big",
			type: "user",
			message: { content: big },
		});
		const { records, errors } = parseTranscript(text);
		expect(errors).toHaveLength(0);
		expect(records[0]?.textContent?.length).toBe(big.length);
	});

	it("returns empty results for empty input", () => {
		expect(parseTranscript("")).toEqual({ records: [], errors: [] });
	});
});
