import "server-only";

import { eq } from "drizzle-orm";
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { person } from "@/lib/schema";

/**
 * THE shared server-side auth contract. The ingest and UI agents code against
 * these signatures — keep them stable.
 *
 *   getSession():     Promise<Session | null>
 *       Raw Better Auth session (user + session), or null if signed out.
 *
 *   getViewer():      Promise<Viewer | null>
 *       The resolved caller: the Better Auth user, the domain `person` row
 *       mirroring it (created on first call if missing), and the active org
 *       ({ id, name, role } | null). Returns null when signed out.
 *
 *   requireSession(): Promise<Session>
 *       getSession() or redirect("/sign-in").
 *
 *   requireViewer():  Promise<Viewer>
 *       getViewer() or redirect("/sign-in").
 *
 *   ensureActiveOrg(): Promise<ActiveOrg | null>
 *       Resolve the active org, persisting it on the session if it has drifted
 *       (e.g. a fresh session whose active org wasn't set). Does NOT create an
 *       org — a brand-new user has none until onboarding mints one.
 *
 * A `Viewer.person.id` is the attribution key other code uses to tie domain
 * rows (claims, briefings, …) back to the human who produced them.
 */

type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export interface ActiveOrg {
	id: string;
	name: string;
	role: string;
}

export interface ViewerPerson {
	id: string;
	displayName: string;
	email: string | null;
}

export interface Viewer {
	user: Session["user"];
	person: ViewerPerson;
	activeOrg: ActiveOrg | null;
}

/** Raw Better Auth session for the current request, or null. */
export async function getSession(): Promise<Session | null> {
	const h = await nextHeaders();
	const session = await auth.api.getSession({ headers: h });
	return session ?? null;
}

/** getSession() or redirect to sign-in. */
export async function requireSession(): Promise<Session> {
	const session = await getSession();
	if (!session) {
		redirect("/sign-in");
	}
	return session;
}

/**
 * Ensure a domain `person` row exists for this Better Auth user, returning it.
 * Looks up by `authUserId`; inserts one (with a `per_…` id, name, email) if
 * missing. Idempotent enough for first-sign-in races: a unique index on
 * `auth_user_id` would reject a duplicate, so we re-read on conflict.
 */
async function ensurePerson(user: Session["user"]): Promise<ViewerPerson> {
	const existing = await db
		.select({
			id: person.id,
			displayName: person.displayName,
			email: person.email,
		})
		.from(person)
		.where(eq(person.authUserId, user.id))
		.limit(1);

	const found = existing[0];
	if (found) {
		return found;
	}

	const inserted = await db
		.insert(person)
		.values({
			id: newId("person"),
			authUserId: user.id,
			displayName: user.name,
			email: user.email,
		})
		.onConflictDoNothing({ target: person.authUserId })
		.returning({
			id: person.id,
			displayName: person.displayName,
			email: person.email,
		});

	const row = inserted[0];
	if (row) {
		return row;
	}

	// Lost an insert race: another request created the row first. Re-read it.
	const reread = await db
		.select({
			id: person.id,
			displayName: person.displayName,
			email: person.email,
		})
		.from(person)
		.where(eq(person.authUserId, user.id))
		.limit(1);

	const after = reread[0];
	if (!after) {
		throw new Error(`failed to create or find person for user ${user.id}`);
	}
	return after;
}

/**
 * Resolve the active org (id, name, role) for the current session, or null if
 * the caller has no membership. Prefers `session.activeOrganizationId`, falling
 * back to the first membership. The role comes from the org's member list.
 */
async function resolveActiveOrg(session: Session): Promise<ActiveOrg | null> {
	const h = await nextHeaders();
	const orgs = await auth.api.listOrganizations({ headers: h });
	const org = orgs.find((o) => o.id === session.session.activeOrganizationId) ?? orgs[0];
	if (!org) {
		return null;
	}

	const full = await auth.api.getFullOrganization({
		headers: h,
		query: { organizationId: org.id },
	});
	const role = full?.members?.find((m) => m.userId === session.user.id)?.role ?? "member";

	return { id: org.id, name: org.name, role };
}

/**
 * The resolved caller: user, mirrored `person`, and active org. Returns null
 * when signed out. Creates the `person` row on first access.
 */
export async function getViewer(): Promise<Viewer | null> {
	const session = await getSession();
	if (!session) {
		return null;
	}
	const personRow = await ensurePerson(session.user);
	const activeOrg = await resolveActiveOrg(session);
	return { user: session.user, person: personRow, activeOrg };
}

/** getViewer() or redirect to sign-in. */
export async function requireViewer(): Promise<Viewer> {
	const viewer = await getViewer();
	if (!viewer) {
		redirect("/sign-in");
	}
	return viewer;
}

/**
 * Resolve the active org, persisting it on the session when it has drifted from
 * what the session currently records. Does NOT create an org — a brand-new user
 * has none until onboarding mints one (the (app) layout redirects there).
 */
export async function ensureActiveOrg(): Promise<ActiveOrg | null> {
	const h = await nextHeaders();
	const session = await getSession();
	if (!session) {
		return null;
	}

	const orgs = await auth.api.listOrganizations({ headers: h });
	const org = orgs.find((o) => o.id === session.session.activeOrganizationId) ?? orgs[0];
	if (!org) {
		return null;
	}

	if (session.session.activeOrganizationId !== org.id) {
		await auth.api.setActiveOrganization({
			headers: h,
			body: { organizationId: org.id },
		});
	}

	const full = await auth.api.getFullOrganization({
		headers: h,
		query: { organizationId: org.id },
	});
	const role = full?.members?.find((m) => m.userId === session.user.id)?.role ?? "member";

	return { id: org.id, name: org.name, role };
}
