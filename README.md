# Depot uploader (Claude Code plugin)

Ships your **new** Claude Code transcript records to your team's
[Depot](https://depot.ingram.tech) server, so Depot can distill them into cited,
per-project Memories. Uploads are **incremental** (only lines added since the
last run) and **idempotent** (safe to run repeatedly and safe to interrupt).

It is two things in one directory:

- A standalone CLI — `bin/depot-upload.ts` — runnable with `bun` or `node`, with
  zero dependencies. Use it from a shell, a cron job, or `--watch`.
- A Claude Code plugin that runs the CLI automatically after each session via a
  `SessionEnd` hook, plus a `/depot:depot-sync` slash command for on-demand syncs.

## What is and isn't sent (privacy)

**Sent to the internal Depot server** (over HTTPS, with a bearer token):

- The **raw transcript JSONL records** for sessions on this machine — i.e. the
  full content of your Claude Code conversations and tool calls. This is the
  whole point: Depot reads transcripts to build memory.
- A **machine fingerprint** (a random per-install UUID hashed with the hostname),
  your `hostname`, and `os` (`process.platform`).
- Your **Claude account identifier** (account UUID and email, read from
  `~/.claude.json`), so uploads are attributed per person+machine.
- Per file: the session id, the absolute project path, the git `origin` remote
  URL and current branch (best effort), and a sha256 of the bytes uploaded.

**Never sent:** any tokens or secrets. The uploader does **not** read
`~/.claude/.credentials.json` or any OAuth/API tokens. Only non-secret account
fields (account UUID, email, user id) are read from `~/.claude.json`.

If you don't want a transcript uploaded, don't run the plugin in that session
(or unset `DEPOT_TOKEN`) — with no token the uploader exits cleanly and sends
nothing.

## Requirements

- `bun` (preferred) or Node.js ≥ 20. The CLI runs the `.ts` files directly:
  `bun` runs TypeScript natively; Node ≥ 22.6 strips types natively
  (`--experimental-strip-types` on 20.x — Node 22+ needs no flag).
- A `DEPOT_TOKEN` (see below).

## Configuration (env vars)

| Var                  | Required | Default                      | Meaning                                              |
| -------------------- | -------- | ---------------------------- | ---------------------------------------------------- |
| `DEPOT_TOKEN`        | yes\*    | —                            | Bearer token for `POST /api/ingest`.                 |
| `DEPOT_URL`          | no       | `https://depot.ingram.tech`  | Depot server base URL.                               |
| `DEPOT_ACCOUNT_ID`   | no       | from `~/.claude.json`        | Override the account identifier.                     |
| `DEPOT_PROJECTS_DIR` | no       | `~/.claude/projects`         | Where transcript JSONL files live.                   |
| `DEPOT_WATCH_SECONDS`| no       | `60`                         | Poll interval for `--watch`.                         |
| `XDG_STATE_HOME`     | no       | `~/.claude`                  | If set, state lives in `$XDG_STATE_HOME/depot`.      |

\* Not required with `--dry-run`. Without a token a real run exits non-zero and
the auto-sync hook stays silent.

### How to get a `DEPOT_TOKEN`

Ask a Depot admin to mint an ingest token for you. It's a `dpt_…` bearer token
tied to your person + organization; Depot stores only a hash of it and shows the
raw value once, at creation. Put it in your shell profile so both your shell and
Claude Code's hooks inherit it:

```bash
echo 'export DEPOT_TOKEN="dpt_…"' >> ~/.zshrc   # or ~/.bashrc
```

## CLI usage

```bash
# one pass (default); prints a one-line summary
bun bin/depot-upload.ts --once

# see what would be sent — no network, no cursor changes
bun bin/depot-upload.ts --dry-run --verbose

# only a specific project (substring match on the project path)
bun bin/depot-upload.ts --once --project depot.ingram.tech

# run continuously, polling every 60s (good for a long-lived terminal/tmux)
bun bin/depot-upload.ts --watch

# with node instead of bun
node bin/depot-upload.ts --once
```

Flags: `--once` (default) · `--watch` · `--watch-seconds N` · `--dry-run` ·
`--project <substr>` · `--verbose` / `-v` · `--help`.

### Run on a schedule (cron)

```cron
# every 10 minutes
*/10 * * * * DEPOT_TOKEN=dpt_… /usr/bin/node /path/to/plugin/bin/depot-upload.ts --once >> ~/.claude/depot/cron.log 2>&1
```

## Install as a Claude Code plugin

The plugin auto-syncs after every session and adds the `/depot:depot-sync`
command.

**Via the public marketplace** (recommended) — this repo is a single-plugin
marketplace, so add it by `owner/repo` and install:

```text
/plugin marketplace add ingram-technologies/claude-plugin-depot
/plugin install depot@depot
```

**Local / development** — point Claude Code at a checkout of this repo:

```bash
claude --plugin-dir /path/to/claude-plugin-depot
```

or add the local checkout as a marketplace:

```text
/plugin marketplace add /path/to/claude-plugin-depot
/plugin install depot@depot
```

After install, set `DEPOT_TOKEN` in your shell profile (so the hook inherits it)
and start a session. When a session ends, the `SessionEnd` hook runs
`depot-upload --once` **in the background** — it never blocks you, and every
failure is silent (logged to `~/.claude/depot/sync.log`). Run `/depot:depot-sync`
any time to sync on demand and see the summary.

## State / cursor

State lives in `~/.claude/depot/` (or `$XDG_STATE_HOME/depot`):

- `state.json` — per absolute file path → `{ bytesUploaded, linesUploaded,
  sha256OfLastUpload, lastRunAt }`. On each run the uploader reads each
  transcript, takes everything past `bytesUploaded`, `JSON.parse`s the new lines
  (malformed lines are skipped, the rest still upload), and batches them per
  file. **The cursor for a file advances only after that file's upload returns
  2xx**, so an interrupted run just re-sends the same lines next time and the
  server dedups them by record uuid. A trailing partial line (a session still
  appending) is left un-cursored until it's complete.
- `machine.json` — the random per-install UUID behind the machine fingerprint.
- `sync.log` — rotating log from the auto-sync hook.

Deleting `state.json` makes the next run re-upload everything (still idempotent —
the server dedups by record uuid).

## Files

```
claude-plugin-depot/
├── .claude-plugin/
│   ├── plugin.json        # plugin manifest
│   └── marketplace.json   # single-plugin marketplace descriptor
├── bin/depot-upload.ts    # CLI entrypoint
├── src/                   # config, identity, state, scan, upload, run
├── hooks/
│   ├── hooks.json         # SessionEnd → depot-sync.sh (async)
│   └── depot-sync.sh      # background, silent, non-fatal sync
├── commands/depot-sync.md # /depot:depot-sync slash command
└── package.json
```
