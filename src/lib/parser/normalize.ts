/**
 * Validate and project one raw transcript record into a {@link NormalizedRecord}.
 *
 * The schema is deliberately permissive: unknown fields pass straight through
 * into `raw`, and only a usable `uuid` is truly required. Anything we cannot
 * classify still survives verbatim in `raw`, so no information is lost.
 */

import { z } from "zod";
import type { NormalizedRecord, RawRecord } from "./types";

/** A single content block inside an assistant/user `message.content` array. */
const contentBlock = z
	.object({
		type: z.string().optional(),
		text: z.string().optional(),
		thinking: z.string().optional(),
		name: z.string().optional(),
		input: z.unknown().optional(),
		// tool_result fields:
		tool_use_id: z.string().optional(),
		content: z.unknown().optional(),
		is_error: z.boolean().optional(),
	})
	.loose();

type ContentBlock = z.infer<typeof contentBlock>;

const usage = z
	.object({
		input_tokens: z.number().optional(),
		output_tokens: z.number().optional(),
		cache_read_input_tokens: z.number().optional(),
	})
	.loose();

const message = z
	.object({
		role: z.string().optional(),
		model: z.string().optional(),
		content: z.union([z.string(), z.array(contentBlock)]).optional(),
		usage: usage.optional(),
	})
	.loose();

/** Only `uuid` is required; everything else is best-effort. */
const recordSchema = z
	.object({
		uuid: z.string().min(1),
		parentUuid: z.string().nullish(),
		sessionId: z.string().nullish(),
		type: z.string().nullish(),
		subtype: z.string().nullish(),
		isSidechain: z.boolean().nullish(),
		isMeta: z.boolean().nullish(),
		cwd: z.string().nullish(),
		gitBranch: z.string().nullish(),
		timestamp: z.string().nullish(),
		/** Top-level string content (e.g. `system` records). */
		content: z.string().nullish(),
		message: message.nullish(),
	})
	.loose();

const MAX_INPUT_PREVIEW = 200;

function nullableNumber(value: number | undefined): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseTimestamp(value: string | null | undefined): Date | null {
	if (!value) return null;
	const ms = Date.parse(value);
	return Number.isNaN(ms) ? null : new Date(ms);
}

/** Compact, single-line rendering of a tool_use `input` for `textContent`. */
function compactInput(input: unknown): string {
	if (input === undefined || input === null) return "";
	let text: string;
	try {
		text = typeof input === "string" ? input : JSON.stringify(input);
	} catch {
		text = String(input);
	}
	const flat = text.replace(/\s+/g, " ").trim();
	return flat.length > MAX_INPUT_PREVIEW
		? `${flat.slice(0, MAX_INPUT_PREVIEW)}…`
		: flat;
}

/** tool_result `content` is a string or an array of `{type:"text",text}`. */
function flattenToolResult(content: unknown): string {
	if (typeof content === "string") return content.trim();
	if (Array.isArray(content)) {
		const parts: string[] = [];
		for (const block of content) {
			if (typeof block === "string") {
				parts.push(block);
			} else if (block && typeof block === "object") {
				const text = (block as Record<string, unknown>).text;
				if (typeof text === "string") parts.push(text);
			}
		}
		return parts.join("\n").trim();
	}
	return "";
}

/** First tool_use name found in a content array, if any. */
function findToolName(blocks: ContentBlock[]): string | null {
	for (const block of blocks) {
		if (block.type === "tool_use" && typeof block.name === "string") {
			return block.name;
		}
	}
	return null;
}

/**
 * Flatten a record's salient text into a faithful-but-compact human-readable
 * string. This feeds LLM extraction, so it favours signal over fidelity:
 * thinking blocks are skipped, tool calls become `[tool: name {input}]`.
 */
function flattenText(
	topContent: string | null | undefined,
	content: string | ContentBlock[] | undefined,
): string | null {
	if (typeof content === "string") {
		const trimmed = content.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	if (!Array.isArray(content)) {
		const top = topContent?.trim();
		return top && top.length > 0 ? top : null;
	}
	const parts: string[] = [];
	for (const block of content) {
		switch (block.type) {
			case "text":
				if (block.text) parts.push(block.text.trim());
				break;
			case "thinking":
				// Skipped: reasoning is noise for extraction. TODO: optional summary.
				break;
			case "tool_use": {
				const name = block.name ?? "?";
				const input = compactInput(block.input);
				parts.push(input ? `[tool: ${name} ${input}]` : `[tool: ${name}]`);
				break;
			}
			case "tool_result": {
				const body = flattenToolResult(block.content);
				const prefix = block.is_error ? "[tool_result error] " : "[tool_result] ";
				if (body) parts.push(prefix + body);
				break;
			}
			default:
				if (block.text) parts.push(block.text.trim());
				break;
		}
	}
	const joined = parts.filter((p) => p.length > 0).join("\n").trim();
	return joined.length > 0 ? joined : null;
}

/**
 * Project one raw record. Returns `null` when the input is not an object or has
 * no usable `uuid`. Large tool outputs replaced by a `<persisted-output>`
 * marker are kept as their inline 2KB preview text.
 * TODO: resolve full persisted tool output from the referenced path (future).
 */
export function normalizeRecord(raw: unknown): NormalizedRecord | null {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		return null;
	}
	const parsed = recordSchema.safeParse(raw);
	if (!parsed.success) return null;

	const data = parsed.data;
	const original = raw as RawRecord;
	const msg = data.message ?? undefined;
	const content = msg?.content;
	const blocks = Array.isArray(content) ? content : [];

	return {
		uuid: data.uuid,
		parentUuid: data.parentUuid ?? null,
		providerSessionId: data.sessionId ?? null,
		recordType: data.type ?? "unknown",
		subtype: data.subtype ?? null,
		isSidechain: data.isSidechain ?? false,
		isMeta: data.isMeta ?? false,
		role: msg?.role ?? null,
		model: msg?.model ?? null,
		cwd: data.cwd ?? null,
		gitBranch: data.gitBranch ?? null,
		ts: parseTimestamp(data.timestamp),
		inputTokens: nullableNumber(msg?.usage?.input_tokens),
		outputTokens: nullableNumber(msg?.usage?.output_tokens),
		cacheReadTokens: nullableNumber(msg?.usage?.cache_read_input_tokens),
		textContent: flattenText(data.content, content),
		toolName: findToolName(blocks),
		raw: original,
	};
}
