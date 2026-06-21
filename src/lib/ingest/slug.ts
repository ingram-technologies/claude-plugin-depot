/**
 * Pure, dependency-free string helpers for project identity. Kept separate from
 * `project.ts` so they're unit-testable without pulling in the DB layer.
 */

/** Last non-empty path segment of a canonical remote or abs path. */
export function basenameOf(input: string): string {
	const cleaned = input.replace(/\.git$/i, "").replace(/[/\\]+$/, "");
	const parts = cleaned.split(/[/\\]/).filter((p) => p.length > 0);
	return parts.at(-1) ?? cleaned;
}

/** Derive a url-safe slug stem from a name. Never empty. */
export function slugify(name: string): string {
	const slug = name
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug.length > 0 ? slug : "project";
}

/**
 * The `local:` identity for a repo with no resolvable git remote. Stable across
 * uploads from the same machine + path → idempotent project resolution.
 */
export function localRemote(machineKey: string, projectPathAbs: string): string {
	return `local:${machineKey}:${projectPathAbs}`;
}

/**
 * Given the set of already-taken slugs, pick a free slug from `stem`, appending
 * a numeric suffix (`-2`, `-3`, …) until free. Pure; the DB unique index is the
 * final arbiter under concurrency.
 */
export function nextFreeSlug(stem: string, taken: ReadonlySet<string>): string {
	if (!taken.has(stem)) {
		return stem;
	}
	let n = 2;
	while (taken.has(`${stem}-${n}`)) {
		n += 1;
	}
	return `${stem}-${n}`;
}
