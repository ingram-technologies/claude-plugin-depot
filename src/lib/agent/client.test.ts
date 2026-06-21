import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the IC adapter so no real provider/network is created.
vi.mock("@ingram-tech/ai-sdk-adapter", () => ({
	createIngramCloud: () => () => ({ mockModel: true }),
}));

// Mock the AI SDK. We drive generateObject / generateText per-test.
const mocks = vi.hoisted(() => {
	class NoObjectGeneratedError extends Error {}
	return {
		generateObject: vi.fn(),
		generateText: vi.fn(),
		NoObjectGeneratedError,
	};
});
const { generateObject, generateText, NoObjectGeneratedError } = mocks;

vi.mock("ai", () => ({
	generateObject: mocks.generateObject,
	generateText: mocks.generateText,
	NoObjectGeneratedError: mocks.NoObjectGeneratedError,
}));

import { z } from "zod";
import { runStructured } from "./client";
import { EXTRACTOR_AGENT } from "./specs";

const schema = z.object({ ok: z.boolean(), n: z.number() });

beforeEach(() => {
	generateObject.mockReset();
	generateText.mockReset();
	process.env.INGRAM_CLOUD_TOKEN = "tha_live_test";
});

describe("runStructured", () => {
	it("returns the validated object from generateObject", async () => {
		generateObject.mockResolvedValue({ object: { ok: true, n: 3 } });
		const out = await runStructured({
			agent: EXTRACTOR_AGENT,
			schema,
			prompt: "hi",
		});
		expect(out).toEqual({ ok: true, n: 3 });
		expect(generateText).not.toHaveBeenCalled();
	});

	it("falls back to generateText + JSON parse when generateObject can't make an object", async () => {
		generateObject.mockRejectedValue(new NoObjectGeneratedError("nope"));
		generateText.mockResolvedValue({
			text: '```json\n{ "ok": false, "n": 7 }\n```',
		});
		const out = await runStructured({
			agent: EXTRACTOR_AGENT,
			schema,
			prompt: "hi",
		});
		expect(out).toEqual({ ok: false, n: 7 });
		expect(generateText).toHaveBeenCalledTimes(1);
	});

	it("retries once on a transient error then succeeds", async () => {
		generateObject
			.mockRejectedValueOnce(new Error("503 service unavailable"))
			.mockResolvedValueOnce({ object: { ok: true, n: 1 } });
		const out = await runStructured({
			agent: EXTRACTOR_AGENT,
			schema,
			prompt: "hi",
		});
		expect(out).toEqual({ ok: true, n: 1 });
		expect(generateObject).toHaveBeenCalledTimes(2);
	});

	it("rejects model output that violates the schema (no as-cast lies)", async () => {
		generateObject.mockRejectedValue(new NoObjectGeneratedError("nope"));
		generateText.mockResolvedValue({ text: '{"ok":"yes","n":"three"}' });
		await expect(
			runStructured({ agent: EXTRACTOR_AGENT, schema, prompt: "hi" }),
		).rejects.toThrow();
	});
});
