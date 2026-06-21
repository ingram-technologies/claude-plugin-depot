/**
 * Public surface of the ingest pipeline. Import from `@/lib/ingest`.
 */

export {
  hashToken,
  issueIngestToken,
  revokeIngestToken,
  verifyIngestToken,
  type IngestAuth,
} from "./tokens";
export { resolveAccount, resolveMachine, type AccountInput, type MachineInput } from "./identity";
export {
  basenameOf,
  computeCanonicalRemote,
  resolveProject,
  slugify,
  type ResolvedProject,
  type ResolveProjectInput,
} from "./project";
export {
  detectFork,
  resolveSession,
  updateSessionStats,
  type ResolveSessionInput,
} from "./session";
export { ingestRecords, type IngestRecordsResult } from "./records";
export { ingestUpload, type IngestFile, type IngestPayload, type IngestResponse } from "./ingest";
export { ingestPayloadSchema, type ValidatedPayload } from "./validation";
