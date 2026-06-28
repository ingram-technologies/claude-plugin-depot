---
description: Connect this machine to Depot via the browser (no token copy-paste)
allowed-tools: [Bash]
---

# /depot-login

Connect this machine to your team's Depot by signing in through the browser. No
manual token creation or copy-paste — the token is delivered straight back to
this machine and saved locally for the uploader.

## Instructions

1. Run the login helper (prefer `bun`, else `node`). It will print a URL and try
   to open your browser; you sign in (if needed) and click **Authorize**:

   ```bash
   RUNTIME=$(command -v bun >/dev/null 2>&1 && echo bun || echo node)
   "$RUNTIME" "${CLAUDE_PLUGIN_ROOT}/bin/depot-login.ts"
   ```

2. Relay the URL it prints (in case the browser didn't open) and tell the user to
   approve in the browser. The command waits for approval, then saves the token.

3. On success it prints where the token was saved and an `export DEPOT_TOKEN=…`
   line. Pass that line along: adding it to their shell profile also enables the
   Depot **MCP tools** (project brief, file context, memory search) for the agent.

4. Once connected, the uploader works automatically — suggest `/depot:depot-sync`
   to upload existing transcripts now.

Do NOT print transcript contents. The token is sensitive — show it only as part
of the `export` line the command itself emitted.
