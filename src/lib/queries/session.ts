/**
 * Server-side session helper. Resolves the Better Auth session and links the
 * auth user to a domain `person` row (creating one on first sight) so curation
 * and other human actions can be attributed. Auth and domain identity are
 * deliberately separate tables; this is the bridge.
 */

import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { maybeOne, one } from "@/lib/db";
import { newId } from "@/lib/ids";

export type Viewer = {
	userId: string;
	personId: string;
	name: string;
	email: string;
};

export async function getViewer(): Promise<Viewer | null> {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return null;
	}
	const { user } = session;
	const personId = await resolvePersonId(user.email, user.name);
	return {
		userId: user.id,
		personId,
		name: user.name,
		email: user.email,
	};
}

/** Find or create the domain `person` for an authenticated user, keyed on email. */
async function resolvePersonId(
	email: string,
	displayName: string,
): Promise<string> {
	const existing = await maybeOne<{ id: string }>(
		`select id from person where email = $1 limit 1`,
		[email],
	);
	if (existing) {
		return existing.id;
	}
	const id = newId("person");
	const created = await one<{ id: string }>(
		`insert into person (id, display_name, email)
		 values ($1, $2, $3)
		 on conflict do nothing
		 returning id`,
		[id, displayName || email, email],
	).catch(async () => {
		// Lost a race; re-read.
		return one<{ id: string }>(
			`select id from person where email = $1 limit 1`,
			[email],
		);
	});
	return created.id;
}
