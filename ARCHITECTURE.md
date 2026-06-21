# Depot — Architecture & Decisions

Depot is **a project's institutional memory**. It ingests Claude Code session
transcripts from across the team and distills them, per project, into durable,
**cited** knowledge: design decisions and their rationale, hard-won gotchas, the
evolving philosophy of each codebase, and its current state.

The long-term vision is an AI-native code project-management tool where humans
and agents discuss and evolve projects. This repo deliberately nails the
**transcripts → trusted, cited Memories** core first; everything else is built
on top of that foundation.

## Stack

- **Next.js 16** (App Router) + React 19, on **Bun**, the nextkit golden path.
- **Postgres** (DigitalOcean managed in prod, **PGlite** for local/test) via
  **Drizzle ORM** — `@ingram-tech/nk-db`.
- **Inference runs entirely on Ingram Cloud** via `@ingram-tech/ai-sdk-adapter`
  (OpenAI-compatible). Analyzer agents are declared as code and managed with
  Pulumi (`@ingram-tech/pulumi-ingram-cloud`).
- **Auth**: Better Auth (employee login for the web UI). Better Auth tables are
  prefixed `auth_` to avoid colliding with domain tables `session`/`account`.
- Lint/format: oxlint + oxfmt (`@ingram-tech/nk-dev`). Tabs, width 88. Validate
  external input with Zod; never `as`. No non-null assertions (`!`).

## The core artifact: a Memory

The atomic unit a human reads and trusts. Small enough to verify in ten seconds.

- `entryType`: `decision | gotcha | principle | state`
- `claim`: ONE falsifiable sentence (the headline)
- `body`: 2–4 sentences — the why / mechanism / fix
- `scope`: the file/module/system it governs
- **provenance**: ≥1 link to concrete transcript records (mandatory — a Memory
  with no receipts cannot exist)
- `confidence`: **derived, not authored** — function of (# independent sessions,
  recency, contradiction). Shown as "seen in 4 sessions over 3 months."
- `status`: `active | superseded | contested | retired`; `supersededById`
- freshness: `firstSeenAt / lastSeenAt / lastConfirmedAt`

A good Memory is falsifiable, durable, non-obvious, traceable. The extractor
optimizes **precision over recall** — a sparse trustworthy memory beats a dense
doubted one. Suppression is the hard part.

## Two-stage knowledge pipeline (high-conviction)

**Rule: never let a fuzzy/nondeterministic process own a unique key.**

1. **Ingest (immutable facts).** Raw records stored verbatim as `jsonb` AND a
   normalized projection. Dedup key is the record's own `uuid`
   (`ON CONFLICT DO NOTHING`) → re-upload is idempotent + incremental for free.
   Project identity = **normalized git remote**, never the absolute path.

2. **Extract (append-only, LLM-driven).** An IC agent reads a session and emits
   `knowledge_claim`s, each with evidence (record uuids). Deterministic
   `fingerprint = hash(run, sorted evidence uuids, normalized content)` with a
   UNIQUE constraint makes re-running a pass insert nothing new.

3. **Canonicalize (separate, mostly-deterministic merge).** Cluster unclustered
   claims (Postgres trigram/FTS candidate retrieval within `project + type`,
   then an IC agent decides merge / new / supersede). Same lesson across 10
   sessions → ONE `knowledge_entry` with 10 evidence rows. Contradiction →
   supersede (old entry stays visible; "we used to think X, now Y" is the
   highest-value artifact). The LLM never writes `knowledge_entry` identity.

Because raw claims persist, we can re-tune merge thresholds or undo a bad merge
**without re-invoking the LLM**.

## Trust

Provenance is an admission requirement, not a feature. Every claim is one click
from the exact source records. Confidence is shown as a count of receipts, not a
vibe percentage. Stale Memories visibly fade. One human "confirm/dispute/
outdated" outranks any amount of AI confidence.

## The hook

The cited **per-project briefing** ("brief me on `infra`"): a tight, ranked,
cited digest of current state + load-bearing decisions + top gotchas, each one
click from its source. Most magical at onboarding/returning to a project.

**Traps avoided first:** the ask-anything chatbot (uncited, unfalsifiable) and a
global everything-feed that reads as noise.

## Visual identity

Dark warm-ink, terminal-adjacent but archival. Background `#16140F`, raised
surface `#1F1C16`, hairline `#2C2820`, ink `#E8E2D4`, muted `#8C8678`. Single
accent: gold `#C8A24A` (links, active, the live edge, the caret — nothing else).
Confidence palette (trust signals only): sage `#7FB069` fresh, gold aging,
terracotta `#B5654A` stale.

**Typographic contract** (load-bearing):
- **serif** (Source Serif 4) = authored, human-readable distilled claims/prose
- **sans** (Inter Tight) = UI chrome, labels, nav
- **mono** (JetBrains Mono) = every machine fact: ids, paths, timestamps, scores

Hairlines not shadows. 6px radius. A 1px gold left-rule marks the recently-
updated "live edge." A single slow gold block caret `▋` is the product heartbeat.

## Module map

```
src/lib/schema.ts        # Drizzle schema — the keystone (this file)
src/lib/db.ts            # pool + drizzle + query helpers
src/lib/ids.ts           # prefixed id generator (prj_, ses_, kc_, ke_, …)
src/lib/parser/          # transcript JSONL parser (pure, tested)
src/lib/ingest/          # dedup, identity + project resolution, session/fork
src/lib/agent/specs.ts   # IC analyzer agent specs (extractor/canonicalizer/briefer)
src/lib/agent/client.ts  # IC inference client (ai-sdk-adapter)
src/lib/pipeline/        # extract + canonicalize + brief orchestration
src/app/api/ingest/      # plugin upload endpoint (token auth)
src/app/(app)/           # web UI (feed, projects, project, memory, search)
src/app/auth/[...all]/   # better-auth handler
plugin/                  # Claude Code plugin (uploader)
pulumi/                  # IcAgent declarations
```

See `src/lib/schema.ts` for the authoritative table definitions and ID prefixes.
