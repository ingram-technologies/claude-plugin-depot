import { describe, expect, it } from "vitest";
import { normalizeRecord } from "./normalize";

describe("normalizeRecord", () => {
	it("normalizes a user text record (string content)", () => {
		const r = normalizeRecord({
			uuid: "u1",
			parentUuid: null,
			sessionId: "s1",
			type: "user",
			timestamp: "2026-06-21T10:00:00.000Z",
			cwd: "/home/x",
			gitBranch: "main",
			message: { role: "user", content: "  hello world  " },
		});
		expect(r).not.toBeNull();
		expect(r?.uuid).toBe("u1");
		expect(r?.recordType).toBe("user");
		expect(r?.role).toBe("user");
		expect(r?.providerSessionId).toBe("s1");
		expect(r?.textContent).toBe("hello world");
		expect(r?.ts?.toISOString()).toBe("2026-06-21T10:00:00.000Z");
		expect(r?.toolName).toBeNull();
	});

	it("normalizes an assistant record with text + thinking + usage", () => {
		const r = normalizeRecord({
			uuid: "a1",
			parentUuid: "u1",
			type: "assistant",
			message: {
				role: "assistant",
				model: "claude-opus-4-8",
				content: [
					{ type: "thinking", thinking: "secret reasoning" },
					{ type: "text", text: "Here is the answer." },
				],
				usage: {
					input_tokens: 100,
					output_tokens: 20,
					cache_read_input_tokens: 5,
				},
			},
		});
		expect(r?.model).toBe("claude-opus-4-8");
		expect(r?.inputTokens).toBe(100);
		expect(r?.outputTokens).toBe(20);
		expect(r?.cacheReadTokens).toBe(5);
		// thinking is skipped; only text survives.
		expect(r?.textContent).toBe("Here is the answer.");
	});

	it("renders a tool_use block and captures toolName", () => {
		const r = normalizeRecord({
			uuid: "a2",
			type: "assistant",
			message: {
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "t1",
						name: "Read",
						input: { file_path: "/a/b.ts" },
					},
				],
			},
		});
		expect(r?.toolName).toBe("Read");
		expect(r?.textContent).toBe('[tool: Read {"file_path":"/a/b.ts"}]');
	});

	it("flattens a tool_result (string content)", () => {
		const r = normalizeRecord({
			uuid: "u2",
			type: "user",
			message: {
				role: "user",
				content: [
					{ type: "tool_result", tool_use_id: "t1", content: "file body" },
				],
			},
		});
		expect(r?.textContent).toBe("[tool_result] file body");
		expect(r?.toolName).toBeNull();
	});

	it("flattens a tool_result array and marks errors", () => {
		const r = normalizeRecord({
			uuid: "u3",
			type: "user",
			message: {
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "t2",
						is_error: true,
						content: [
							{ type: "text", text: "line one" },
							{ type: "text", text: "line two" },
						],
					},
				],
			},
		});
		expect(r?.textContent).toBe("[tool_result error] line one\nline two");
	});

	it("keeps the inline preview of a persisted-output marker", () => {
		const preview =
			"<persisted-output path=\"…/tool-results/x.txt\">first 2KB preview</persisted-output>";
		const r = normalizeRecord({
			uuid: "u4",
			type: "user",
			message: {
				role: "user",
				content: [{ type: "tool_result", tool_use_id: "t3", content: preview }],
			},
		});
		expect(r?.textContent).toContain("persisted-output");
		expect(r?.textContent).toContain("first 2KB preview");
	});

	it("handles unknown record types with top-level content", () => {
		const r = normalizeRecord({
			uuid: "sys1",
			type: "system",
			subtype: "compact_boundary",
			content: "compacted",
		});
		expect(r?.recordType).toBe("system");
		expect(r?.subtype).toBe("compact_boundary");
		expect(r?.textContent).toBe("compacted");
		expect(r?.role).toBeNull();
	});

	it("returns null when uuid is missing", () => {
		expect(normalizeRecord({ type: "mode", mode: "default" })).toBeNull();
		expect(normalizeRecord({ uuid: "" })).toBeNull();
	});

	it("returns null for non-object input", () => {
		expect(normalizeRecord(null)).toBeNull();
		expect(normalizeRecord("nope")).toBeNull();
		expect(normalizeRecord([{ uuid: "x" }])).toBeNull();
	});

	it("preserves the original object as raw", () => {
		const input = { uuid: "u5", type: "user", weirdField: 42 };
		const r = normalizeRecord(input);
		expect(r?.raw).toBe(input);
		expect(r?.raw.weirdField).toBe(42);
	});
});
