# depot.ingram.tech

**Depot — a project's institutional memory.** Ingests Claude Code session
transcripts and distills them, per project, into durable **cited** Memories
(decisions, gotchas, philosophy, state). Inference runs entirely on Ingram Cloud.

Read **`ARCHITECTURE.md`** first — it holds the product thesis, the two-stage
knowledge pipeline, the trust model, and the visual identity. The authoritative
data model is **`src/lib/schema.ts`**.

@./node_modules/@ingram-tech/nk-dev/guide.md

## Stack

Next.js 16 (App Router) · React 19 · Bun · Drizzle + DO-Postgres (PGlite in
dev) via `@ingram-tech/nk-db` · Better Auth (`auth_`-prefixed tables) ·
inference via `@ingram-tech/ai-sdk-adapter` · oxlint + oxfmt.

## House rules

- Tabs, width 88. Validate external input with **Zod**; never `as SomeType`.
- No non-null assertions (`!`); use guard clauses.
- IDs come from `src/lib/ids.ts` (`newId("project")` → `prj_…`).
- Never let a fuzzy/LLM process own a unique key (project = git remote, claim =
  deterministic fingerprint, record = producer uuid).
- Every Memory must carry provenance to real `transcript_record` uuids.

## Commands

```
bun install
bun run db:generate      # drizzle-kit generate after schema changes
bun run db:migrate       # apply migrations (needs DATABASE_URL)
bun run dev              # nk dev (boots PGlite, applies migrations, next dev)
bun run check            # oxlint + oxfmt --check
bun run test             # vitest
```

## Layout

- `src/lib/parser/` — transcript JSONL parser (pure, tested)
- `src/lib/ingest/` — dedup, identity + project resolution, session/fork
- `src/lib/agent/` — IC agent specs + inference client
- `src/lib/pipeline/` — extract → canonicalize → brief
- `src/app/api/ingest/` — plugin upload endpoint
- `src/app/(app)/` — web UI
- `plugin/` — Claude Code uploader plugin
- `pulumi/` — IcAgent declarations
