"use server";

import { requireViewer } from "@/lib/auth-helpers";
import { issueIngestToken } from "@/lib/ingest";

/**
 * Onboarding server actions. The personal-token mint lives here so the raw
 * token is created server-side and returned exactly once — the page shows it,
 * the client stores nothing, and a refresh can never re-reveal it.
 */

type MintResult = { ok: true; token: string; id: string } | { ok: false; error: string };

/**
 * Mint a personal ingest token bound to the viewer + their active org, so the
 * uploader attributes their sessions to them within this tenant. Returns the
 * RAW token once; only its hash is persisted.
 */
export async function mintPersonalToken(): Promise<MintResult> {
	const viewer = await requireViewer();
	if (!viewer.activeOrg) {
		return { ok: false, error: "Join or create an organization first." };
	}
	try {
		const { id, token } = await issueIngestToken({
			label: `${viewer.person.displayName} personal`,
			personId: viewer.person.id,
			organizationId: viewer.activeOrg.id,
		});
		return { ok: true, token, id };
	} catch {
		return { ok: false, error: "Could not mint a token. Try again." };
	}
}
