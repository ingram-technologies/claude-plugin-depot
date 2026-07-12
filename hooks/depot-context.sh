#!/usr/bin/env bash
# Hook shim for the Depot push channel (SessionStart + PreToolUse): pick a
# runtime and run depot-context, passing stdin through and letting its stdout
# (the additionalContext JSON) reach Claude Code. Unlike depot-sync.sh this
# does NOT detach — the whole point is returning context to the session — but
# it shares the same contract: any failure is silent, always exit 0.

set -uo pipefail

ROOT="${CLAUDE_PLUGIN_ROOT:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"}"

if command -v bun >/dev/null 2>&1; then
	RT="bun"
elif command -v node >/dev/null 2>&1; then
	RT="node"
else
	exit 0
fi

"$RT" "${ROOT}/bin/depot-context.ts" 2>/dev/null
exit 0
