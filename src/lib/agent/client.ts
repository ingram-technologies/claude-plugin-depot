/**
 * Ingram Cloud inference client for the analyzer pipeline.
 *
 * All inference in Depot runs on Ingram Cloud — never a direct OpenAI/Anthropic
 * call. We use `@ingram-tech/ai-sdk-adapter` (an `@ai-sdk/openai-compatible`
 * provider over IC's `/v1/chat/completions`) with the Vercel AI SDK.
 *
 * ## How an agent is targeted
 *
 * IC's OpenAI-compatible surface runs as a SMITH (a `smt_` id — one end-user's
 * running clone of an agent); the agent's design (instructions/model) is resolved
 * from the smith, NOT from an `agt_` id passed on the request. So a chat
 * completion cannot select an agent purely by its `agt_` id.
 *
 * Depot declares its three agents in `specs.ts` for governance + Pulumi, but for
 * the actual inference calls we send `model` + our own `system` instructions
 * (the spec's `instructions`) directly. This is faithful: the spec text IS the
 * agent's instructions. If a per-task SMITH is provisioned that runs the agent,
 * set `DEPOT_<TASK>_SMITH_ID` and we'll pass it as `IC-Smith-Id`, which makes the
 * call run as that smith (its memory/threads/governance) over the same model.
 *
 * TODO(agent-targeting): when a smith-per-task is provisioned, the system prompt
 * becomes redundant with the agent's own instructions; drop the inline `system`
 * for tasks where `*_SMITH_ID` is set to avoid double instructions.
 */

import { createIngramCloud } from "@ingram-tech/ai-sdk-adapter";
import { generateObject, generateText, type ModelMessage, NoObjectGeneratedError } from "ai";
import type { z } from "zod";
import type { AgentSpec } from "./specs";

export type ProviderOptions = {
  apiKey?: string;
  baseURL?: string;
  smithId?: string;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

/** Build an IC provider from env (or explicit overrides). One per logical caller;
 *  provider creation is cheap. */
export function getProvider(opts: ProviderOptions = {}) {
  const apiKey = opts.apiKey ?? requireEnv("INGRAM_CLOUD_TOKEN");
  const baseURL = opts.baseURL ?? process.env.INGRAM_CLOUD_BASE_URL ?? undefined;
  return createIngramCloud({ apiKey, baseURL, smithId: opts.smithId });
}

/** Resolve the optional per-task smith that runs a given agent, if provisioned. */
function smithIdFor(agent: AgentSpec): string | undefined {
  const key =
    agent.slug === "depot-extractor"
      ? "DEPOT_EXTRACTOR_SMITH_ID"
      : agent.slug === "depot-canonicalizer"
        ? "DEPOT_CANONICALIZER_SMITH_ID"
        : "DEPOT_BRIEFER_SMITH_ID";
  return process.env[key] || undefined;
}

export type RunInput = {
  agent: AgentSpec;
  /** Extra system text appended after the agent's instructions. */
  system?: string;
  /** Single-turn prompt (mutually exclusive with `messages`). */
  prompt?: string;
  /** Full message list (mutually exclusive with `prompt`). */
  messages?: ModelMessage[];
  /** Optional provider overrides (mostly for tests). */
  provider?: ProviderOptions;
};

const TRANSIENT = /\b(429|500|502|503|504|timeout|ETIMEDOUT|ECONNRESET|fetch)\b/i;

function isTransient(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return TRANSIENT.test(msg);
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!isTransient(e)) throw e;
    // Single retry on transient failure, brief backoff.
    await new Promise((r) => setTimeout(r, 750));
    return await fn();
  }
}

function systemFor(agent: AgentSpec, extra?: string): string {
  // When a smith runs the agent, IC already carries the instructions; otherwise
  // we send them inline. We always send them inline today (see TODO above) since
  // smith-per-task is optional.
  return extra ? `${agent.instructions}\n\n${extra}` : agent.instructions;
}

/**
 * Run a structured-output inference and return a Zod-validated object.
 *
 * Tries the AI SDK's `generateObject` (maps to `response_format` json_schema). If
 * the OpenAI-compatible provider can't produce a clean object, falls back to
 * `generateText` with a strict-JSON instruction and parses with the same schema.
 * Either way the result is validated by `schema` — we never `as`-cast model output.
 */
export async function runStructured<T>(input: RunInput & { schema: z.ZodType<T> }): Promise<T> {
  const { agent, schema, system, prompt, messages, provider: pOpts } = input;
  const provider = getProvider({ ...pOpts, smithId: smithIdFor(agent) });
  const model = provider(""); // "" → use the (smith's) agent model; tenant calls fall back to spec model server-side
  const sys = systemFor(agent, system);

  return withRetry(async () => {
    try {
      const result = await generateObject({
        model,
        schema,
        system: sys,
        ...(messages ? { messages } : { prompt: prompt ?? "" }),
      });
      return result.object;
    } catch (e) {
      // Fall back to text + strict JSON if structured output isn't supported
      // or the object didn't validate.
      if (
        !(e instanceof NoObjectGeneratedError) &&
        !/response_format|json_schema|schema|object/i.test(
          e instanceof Error ? e.message : String(e),
        )
      ) {
        throw e;
      }
      const jsonSys = `${sys}\n\nReturn ONLY a single JSON object that conforms to the required shape. No prose, no markdown fences.`;
      const text = await generateText({
        model,
        system: jsonSys,
        ...(messages ? { messages } : { prompt: prompt ?? "" }),
      });
      return schema.parse(extractJson(text.text));
    }
  });
}

/** Free-text inference (the briefing). Returns the raw model text. */
export async function runText(input: RunInput): Promise<string> {
  const { agent, system, prompt, messages, provider: pOpts } = input;
  const provider = getProvider({ ...pOpts, smithId: smithIdFor(agent) });
  const model = provider("");
  const sys = systemFor(agent, system);
  return withRetry(async () => {
    const result = await generateText({
      model,
      system: sys,
      ...(messages ? { messages } : { prompt: prompt ?? "" }),
    });
    return result.text;
  });
}

/** Pull the first JSON object/array out of a possibly fenced text blob. */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    // Last resort: slice from the first brace/bracket to its match.
    const start = candidate.search(/[{[]/);
    if (start === -1) throw new Error("No JSON found in model output");
    return JSON.parse(candidate.slice(start));
  }
}
