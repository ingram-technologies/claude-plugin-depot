import { describe, expect, it } from "vitest";

import { parseHookInput } from "./context.ts";

describe("parseHookInput", () => {
	it("parses a SessionStart event", () => {
		const input = parseHookInput(
			JSON.stringify({
				hook_event_name: "SessionStart",
				session_id: "abc-123",
				cwd: "/home/u/repo",
			}),
		);
		expect(input).toEqual({
			hookEventName: "SessionStart",
			sessionId: "abc-123",
			cwd: "/home/u/repo",
			filePath: null,
			source: null,
		});
	});

	it("lifts file_path from an Edit PreToolUse event", () => {
		const input = parseHookInput(
			JSON.stringify({
				hook_event_name: "PreToolUse",
				session_id: "abc-123",
				cwd: "/home/u/repo",
				tool_name: "Edit",
				tool_input: { file_path: "/home/u/repo/src/x.ts", old_string: "a" },
			}),
		);
		expect(input?.filePath).toBe("/home/u/repo/src/x.ts");
	});

	it("lifts notebook_path from a NotebookEdit event", () => {
		const input = parseHookInput(
			JSON.stringify({
				hook_event_name: "PreToolUse",
				session_id: "s",
				cwd: "/r",
				tool_name: "NotebookEdit",
				tool_input: { notebook_path: "/r/nb.ipynb" },
			}),
		);
		expect(input?.filePath).toBe("/r/nb.ipynb");
	});

	it("tolerates malformed and non-object stdin", () => {
		expect(parseHookInput("not json")).toBeNull();
		expect(parseHookInput('"a string"')).toBeNull();
		expect(parseHookInput("[]")).toBeNull();
	});

	it("nulls out missing fields instead of throwing", () => {
		const input = parseHookInput("{}");
		expect(input).toEqual({
			hookEventName: "",
			sessionId: null,
			cwd: null,
			filePath: null,
			source: null,
		});
	});

	it("carries the SessionStart source through", () => {
		const input = parseHookInput(
			JSON.stringify({ hook_event_name: "SessionStart", source: "resume" }),
		);
		expect(input?.source).toBe("resume");
	});
});
