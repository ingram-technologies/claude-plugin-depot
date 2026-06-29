---
description: Connect this machine to Depot via the browser (no token copy-paste)
allowed-tools: [Bash]
---

# /depot-login

Connect this machine to your team's Depot by signing in through the browser.

The login helper is **self-contained**: it opens the browser, captures the token
over a localhost loopback, and saves it to a private credentials file. It prints
**no token** — the uploader and the agent's MCP tools read it from that file
automatically (the MCP via a `headersHelper`), so nothing is ever copied or
exposed.

> Prefer it programmatic? Run `bun "${CLAUDE_PLUGIN_ROOT}/bin/depot-login.ts"`
> yourself in a terminal — no agent, no model turn. This command is just a
> convenience wrapper around that.

## Instructions

1. Run the helper (prefer `bun`, else `node`):

   ```bash
   RUNTIME=$(command -v bun >/dev/null 2>&1 && echo bun || echo node)
   "$RUNTIME" "${CLAUDE_PLUGIN_ROOT}/bin/depot-login.ts"
   ```

2. It prints a URL and tries to open the browser. Relay the URL verbatim (so the
   user can open it if needed) and tell them to sign in and click **Authorize**.
   The helper waits, then saves the token and prints a short status.

3. Report only that status line. The helper never emits a token; do not invent,
   echo, or ask for one. After it succeeds, tell the user to run `/reload-plugins`
   (or restart Claude Code) to connect the MCP, then `/depot:depot-sync` to upload.

Never print transcript contents.
