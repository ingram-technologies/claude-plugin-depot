---
description: Upload new Claude Code transcript records to Depot now and report the summary
argument-hint: "[--dry-run] [--project <substr>]"
allowed-tools: [Bash]
---

# /depot-sync

Run the Depot uploader once, on demand, and report the result.

## Instructions

1. Run the uploader with any flags the user passed in `$ARGUMENTS` (pass them
   through verbatim; if empty, run a plain `--once`). Prefer `bun` if available,
   else `node`:

   ```bash
   RUNTIME=$(command -v bun >/dev/null 2>&1 && echo bun || echo node)
   "$RUNTIME" "${CLAUDE_PLUGIN_ROOT}/bin/depot-upload.ts" --once $ARGUMENTS
   ```

2. Report the one-line summary the CLI prints (files uploaded, records
   inserted/deduped, anything skipped or failed). Keep it terse.

3. If it exits non-zero because `DEPOT_TOKEN` is not set, tell the user to set
   `DEPOT_TOKEN` (see the plugin README for how to get one) and stop — do not
   treat it as a code problem.

Do NOT print transcript contents. Only relay the summary line.
