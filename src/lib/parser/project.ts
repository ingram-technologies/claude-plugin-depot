/**
 * Project-identity helpers: decode the `~/.claude/projects/<dir>` directory
 * name back into an absolute path, and canonicalize a git remote into a stable
 * `host/org/repo` identity (the project's true key — never the abs path).
 */

/**
 * Best-effort decode of an encoded project dir name into an absolute path.
 *
 * Claude Code encodes a path by replacing each `/` with `-` and prefixing `-`
 * (e.g. `/home/adys/src/depot` → `-home-adys-src-depot`). The encoding is
 * lossy — a literal `-` in a path segment is indistinguishable from a `/` — so
 * we restore the leading slash and convert the remaining dashes to slashes.
 * Real-dash directories will decode wrong; callers should treat this as a hint.
 */
export function decodeProjectDir(dirName: string): string {
	if (!dirName) return "";
	// Drop the single leading `-` that stands in for the root slash.
	const body = dirName.startsWith("-") ? dirName.slice(1) : dirName;
	return "/" + body.replace(/-/g, "/");
}

/**
 * Canonicalize a git remote URL into `host/org/repo` (lowercased host, creds
 * and ports stripped, `.git` removed). Handles scp-style (`git@host:org/repo`),
 * https, ssh and git protocols. Returns `""` when nothing usable is found.
 */
export function normalizeGitRemote(raw: string): string {
	const input = raw?.trim();
	if (!input) return "";

	let host = "";
	let path = "";

	// scp-like syntax: [user@]host:path  (no scheme, single colon segment).
	const scp = /^(?:[^@/]+@)?([^/:]+):(.+)$/.exec(input);
	const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input);
	if (scp && !hasScheme) {
		host = scp[1] ?? "";
		path = scp[2] ?? "";
	} else {
		let url: URL | null = null;
		try {
			url = new URL(input);
		} catch {
			url = null;
		}
		if (!url) return "";
		// hostname drops creds and port automatically.
		host = url.hostname;
		path = url.pathname;
	}

	host = host.toLowerCase().replace(/^\/+/, "");
	let cleanedPath = path
		.replace(/^\/+/, "")
		.replace(/\/+$/, "")
		.replace(/\.git$/i, "");

	if (!host || !cleanedPath) return "";
	return `${host}/${cleanedPath}`;
}
