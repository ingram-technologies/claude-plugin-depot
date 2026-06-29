#!/usr/bin/env bash
# MCP headersHelper shim: pick a runtime and emit the Depot auth header as JSON.
# Referenced from .mcp.json as ${CLAUDE_PLUGIN_ROOT}/bin/depot-mcp-headers.sh.
# Always prints valid JSON and exits 0 (empty {} when no runtime/token), so the
# MCP server is never broken by a parse failure — at worst it shows "needs auth".
set -uo pipefail

ROOT="${CLAUDE_PLUGIN_ROOT:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"}"

if command -v bun >/dev/null 2>&1; then
	RT="bun"
elif command -v node >/dev/null 2>&1; then
	RT="node"
else
	echo '{}'
	exit 0
fi

exec "$RT" "${ROOT}/bin/depot-mcp-headers.ts"
