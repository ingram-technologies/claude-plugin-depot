/**
 * Project resolution. Project identity is the NORMALIZED git remote, never an
 * absolute path. Resolution runs at ingest time and is fully re-runnable; it
 * must never block ingest on a perfect match — a repo with no remote still
 * resolves, to a stable `local:<machine>:<path>` identity.
 *
 *   1. canonicalRemote = normalizeGitRemote(raw)  (or local: fallback)
 *   2. upsert `project` by canonicalRemote, deriving a unique slug
 *   3. upsert `project_path` by (machineId, absPath) → projectId
 */

import { type SQL, and, eq, isNull, like } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { normalizeGitRemote } from "@/lib/parser";

import { basenameOf, localRemote, nextFreeSlug, slugify } from "./slug";
import type { Tx } from "./tx";

export { basenameOf, slugify } from "./slug";

const { project, projectPath } = schema;

/** NULL-aware org match: `= NULL` never matches in SQL, so orgless projects
 *  (legacy/operator tokens) must compare with IS NULL. */
function orgEq(organizationId?: string): SQL | undefined {
	return organizationId === undefined || organizationId === null
		? isNull(project.organizationId)
		: eq(project.organizationId, organizationId);
}

export type ResolveProjectInput = {
	machineId: string;
	machineFingerprint?: string;
	projectPathAbs: string;
	gitRemoteRaw?: string;
	/** Owning tenant, from the upload's ingest token. Set on first insert. */
	organizationId?: string;
};

export type ResolvedProject = {
	id: string;
	canonicalRemote: string;
	slug: string;
	displayName: string;
};

/**
 * Pick a slug not yet taken by a DIFFERENT project. If `stem` is free, use it;
 * otherwise append `-2`, `-3`, … skipping any already taken. Returns a slug
 * that is currently free (callers still rely on the unique index as the final
 * arbiter under concurrency).
 */
async function deriveUniqueSlug(
	conn: Tx,
	stem: string,
	canonicalRemote: string,
	organizationId?: string,
): Promise<string> {
	// Slugs are unique WITHIN an org, so only consider this org's slugs.
	const rows = await conn
		.select({ slug: project.slug })
		.from(project)
		.where(and(orgEq(organizationId), like(project.slug, `${stem}%`)));
	const taken = new Set<string>();
	for (const r of rows) {
		taken.add(r.slug);
	}
	// If a project with our exact (org, remote) already holds a slug, reuse it.
	const mine = await conn
		.select({ slug: project.slug })
		.from(project)
		.where(and(orgEq(organizationId), eq(project.canonicalRemote, canonicalRemote)))
		.limit(1);
	const existing = mine.at(0);
	if (existing) {
		return existing.slug;
	}

	return nextFreeSlug(stem, taken);
}

/** Compute the canonical remote for the input, applying the local: fallback. */
export function computeCanonicalRemote(input: ResolveProjectInput): string {
	const normalized = input.gitRemoteRaw ? normalizeGitRemote(input.gitRemoteRaw) : "";
	if (normalized.length > 0) {
		return normalized;
	}
	const localKey = input.machineFingerprint ?? input.machineId;
	return localRemote(localKey, input.projectPathAbs);
}

export async function resolveProject(
	input: ResolveProjectInput,
	conn: Tx = db,
): Promise<ResolvedProject> {
	const canonicalRemote = computeCanonicalRemote(input);

	// Prefer the remote basename for the name; fall back to the dir basename.
	const fromRemote = canonicalRemote.startsWith("local:")
		? ""
		: basenameOf(canonicalRemote);
	const displayName =
		fromRemote.length > 0 ? fromRemote : basenameOf(input.projectPathAbs);

	// Project identity is (organizationId, canonicalRemote): the same upstream
	// repo in two orgs is two separate projects. Upsert idempotently and re-read.
	const remoteMatch = and(
		orgEq(input.organizationId),
		eq(project.canonicalRemote, canonicalRemote),
	);
	const existingRows = await conn
		.select({
			id: project.id,
			canonicalRemote: project.canonicalRemote,
			slug: project.slug,
			displayName: project.displayName,
		})
		.from(project)
		.where(remoteMatch)
		.limit(1);
	const existing = existingRows.at(0);
	if (existing) {
		// Always ensure the per-machine path mapping, even for known projects.
		await upsertProjectPath(conn, existing.id, input);
		return existing;
	}

	const slug = await deriveUniqueSlug(
		conn,
		slugify(displayName),
		canonicalRemote,
		input.organizationId,
	);
	const id = newId("project");
	await conn
		.insert(project)
		.values({
			id,
			organizationId: input.organizationId ?? null,
			canonicalRemote,
			slug,
			displayName,
			lastActivityAt: new Date(),
		})
		.onConflictDoNothing({
			target: [project.organizationId, project.canonicalRemote],
		});

	// Re-read: handles the race where a concurrent ingest inserted first.
	const finalRows = await conn
		.select({
			id: project.id,
			canonicalRemote: project.canonicalRemote,
			slug: project.slug,
			displayName: project.displayName,
		})
		.from(project)
		.where(remoteMatch)
		.limit(1);
	const resolved = finalRows.at(0);
	if (!resolved) {
		throw new Error("resolveProject: upsert produced no row");
	}

	await upsertProjectPath(conn, resolved.id, input);
	return resolved;
}

/** Upsert the (machineId, absPath) → projectId mapping. */
async function upsertProjectPath(
	conn: Tx,
	projectId: string,
	input: ResolveProjectInput,
): Promise<void> {
	const existing = await conn
		.select({ id: projectPath.id })
		.from(projectPath)
		.where(
			and(
				eq(projectPath.machineId, input.machineId),
				eq(projectPath.absPath, input.projectPathAbs),
			),
		)
		.limit(1);
	if (existing.at(0)) {
		return;
	}
	await conn
		.insert(projectPath)
		.values({
			id: newId("projectPath"),
			projectId,
			machineId: input.machineId,
			absPath: input.projectPathAbs,
			gitRemoteRaw: input.gitRemoteRaw ?? null,
		})
		.onConflictDoNothing({
			target: [projectPath.machineId, projectPath.absPath],
		});
}
