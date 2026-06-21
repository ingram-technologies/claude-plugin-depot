/**
 * Zod schema for the POST /api/ingest wire contract. ALL external input is
 * validated here; the parsed type feeds `ingestUpload` directly.
 */

import { z } from "zod";

import type { IngestPayload } from "./ingest";

const machineSchema = z.object({
  fingerprint: z.string().min(1),
  hostname: z.string().optional(),
  os: z.string().optional(),
});

const accountSchema = z.object({
  // The contract pins vendor to "anthropic" today; keep it a literal but
  // tolerant of future vendors by accepting any non-empty string fallback.
  vendor: z.string().min(1).default("anthropic"),
  vendorAccountId: z.string().min(1),
  email: z.string().optional(),
});

const fileSchema = z.object({
  providerSessionId: z.string().min(1),
  projectPathAbs: z.string().min(1),
  gitRemoteRaw: z.string().optional(),
  gitBranch: z.string().optional(),
  sha256: z.string().min(1),
  // Raw JSONL record objects — validated/normalized later by the parser.
  records: z.array(z.unknown()),
});

export const ingestPayloadSchema = z.object({
  machine: machineSchema,
  account: accountSchema,
  files: z.array(fileSchema),
});

/** The parsed payload is structurally assignable to IngestPayload. */
export type ValidatedPayload = z.infer<typeof ingestPayloadSchema>;

const _typecheck: (p: ValidatedPayload) => IngestPayload = (p) => p;
void _typecheck;
