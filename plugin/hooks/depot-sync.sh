#!/usr/bin/env bash
# SessionEnd hook for the Depot plugin.
#
# Fires after each Claude Code session ends and kicks off `depot-upload --once`
# in the BACKGROUND so the session never blocks on the network. Every failure
# is swallowed: a missing token, no runtime, or an offline Depot must never
# surface to the user or fail the session. Output goes to a rotating log in the
# state dir, never to the user's terminal.
#
# Requires DEPOT_TOKEN in the environment (or the user's shell profile that
# Claude Code inherits). With no token the uploader exits cleanly and this hook
# stays silent.

set +e

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"}"
CLI="${PLUGIN_ROOT}/bin/depot-upload.ts"

# Pick a runtime: prefer bun, fall back to node. If neither exists, do nothing.
if command -v bun >/dev/null 2>&1; then
	RUNTIME="bun"
elif command -v node >/dev/null 2>&1; then
	RUNTIME="node"
else
	exit 0
fi

STATE_DIR="${XDG_STATE_HOME:-$HOME/.claude}"
LOG_DIR="${STATE_DIR}/depot"
mkdir -p "${LOG_DIR}" 2>/dev/null
LOG_FILE="${LOG_DIR}/sync.log"

# Trim the log if it grows past ~256 KiB so it never accumulates unbounded.
if [ -f "${LOG_FILE}" ] && [ "$(wc -c <"${LOG_FILE}" 2>/dev/null || echo 0)" -gt 262144 ]; then
	tail -c 65536 "${LOG_FILE}" >"${LOG_FILE}.tmp" 2>/dev/null && mv "${LOG_FILE}.tmp" "${LOG_FILE}" 2>/dev/null
fi

# Detach: run in the background, fully disconnected from the session. The hook
# returns immediately so Claude Code is never blocked.
{
	echo "--- $(date -u +%FT%TZ) depot-upload --once" >>"${LOG_FILE}" 2>/dev/null
	"${RUNTIME}" "${CLI}" --once >>"${LOG_FILE}" 2>&1
} </dev/null >/dev/null 2>&1 &

# Always succeed.
exit 0
