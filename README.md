# Depot

**A project's institutional memory.** Depot ingests Claude Code session
transcripts from across the team and distills them, per project, into durable,
**cited** knowledge — the design decisions and why, the hard-won gotchas, the
evolving philosophy of each codebase, and its current state.

It writes itself from how people actually work, instead of from docs people
forget to write. Inference runs entirely on [Ingram Cloud](https://cloud.ingram.tech).

> Long-term this grows into an AI-native code project tool where humans and
> agents discuss and evolve projects. Depot nails the **transcripts → trusted,
> cited Memories** core first.

## How it works

1. A **Claude Code plugin** uploads new transcript records to Depot,
   incrementally and idempotently (identified by machine + Claude account).
2. **Ingestion** dedups by record uuid, resolves identity, and groups sessions
   by project (keyed on the git remote).
3. An **extractor** agent reads each session and emits append-only
   `knowledge_claim`s with provenance.
4. A **canonicalizer** merges claims into a deduplicated set of **Memories**,
   superseding old ones when the project's approach changes.
5. The **web UI** lets engineers (and agents, via API) browse each project's
   Memories and read a cited per-project briefing.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design.

## Develop

```bash
bun install
bun run dev      # boots PGlite, applies migrations, runs Next on :3000
```
