"use server";

import { z } from "zod";

import { requireViewer } from "@/lib/auth-helpers";
import {
	issueIngestToken,
	listTokensForPerson,
	revokeIngestToken,
	type TokenListItem,
} from "@/lib/ingest";

/**
 * Personal-token management actions. All scope to the viewer's own person id —
 * a user can only ever mint/list/revoke their own tokens. Raw token values are
 * returned exactly once, immediately after minting.
 */

type MintResult = { ok: true; token: string; id: string } | { ok: false; error: string };

type RevokeResult = { ok: true } | { ok: false; error: string };

const labelSchema = z.object({
	label: z.string().trim().max(80).optional(),
});

export async function mintToken(input: unknown): Promise<MintResult> {
	const parsed = labelSchema.safeParse(input ?? {});
	if (!parsed.success) {
		return { ok: false, error: "Label too long." };
	}
	const viewer = await requireViewer();
	if (!viewer.activeOrg) {
		return { ok: false, error: "Join or create an organization first." };
	}
	const label =
		parsed.data.label && parsed.data.label.length > 0
			? parsed.data.label
			: `${viewer.person.displayName} personal`;
	try {
		const { id, token } = await issueIngestToken({
			label,
			personId: viewer.person.id,
			organizationId: viewer.activeOrg.id,
		});
		return { ok: true, token, id };
	} catch {
		return { ok: false, error: "Could not mint a token." };
	}
}

const revokeSchema = z.object({ tokenId: z.string().min(1).max(128) });

export async function revokeToken(input: unknown): Promise<RevokeResult> {
	const parsed = revokeSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "Bad request." };
	}
	const viewer = await requireViewer();
	// Only revoke a token that belongs to this viewer.
	const own = await listTokensForPerson(viewer.person.id);
	if (!own.some((t) => t.id === parsed.data.tokenId)) {
		return { ok: false, error: "Not your token." };
	}
	try {
		await revokeIngestToken(parsed.data.tokenId);
		return { ok: true };
	} catch {
		return { ok: false, error: "Could not revoke the token." };
	}
}

export async function listMyTokens(): Promise<TokenListItem[]> {
	const viewer = await requireViewer();
	return listTokensForPerson(viewer.person.id);
}
