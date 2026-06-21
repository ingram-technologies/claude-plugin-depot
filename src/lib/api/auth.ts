import "server-only";

import { verifyIngestToken } from "@/lib/ingest";

/**
 * Bearer-token gate for the public read API. Reuses the ingest-token machinery
 * (sha256-hashed, revocable). Returns the resolved identity or null.
 */
export async function authorizeBearer(
	req: Request,
): Promise<{ tokenId: string; organizationId?: string } | null> {
	const header = req.headers.get("authorization");
	if (!header) {
		return null;
	}
	const match = /^Bearer\s+(.+)$/i.exec(header.trim());
	if (!match?.[1]) {
		return null;
	}
	const auth = await verifyIngestToken(match[1]);
	if (!auth) {
		return null;
	}
	// Scope every read to the token's org so a token only sees its own org.
	return { tokenId: auth.tokenId, organizationId: auth.organizationId };
}

export function unauthorized(): Response {
	return Response.json(
		{ error: "unauthorized", hint: "Authorization: Bearer <token>" },
		{ status: 401 },
	);
}
