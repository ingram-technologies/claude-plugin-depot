"use server";

import { headers as nextHeaders } from "next/headers";

import { auth } from "@/lib/auth";
import { requireViewer } from "@/lib/auth-helpers";

/**
 * Chrome-level server actions: enumerate the viewer's organizations for the org
 * switcher. The actual switch is done client-side with
 * `authClient.organization.setActive` (which writes the active-org cookie) then
 * a router refresh — re-resolving the viewer's tenant on the next render.
 */

export interface OrgOption {
	id: string;
	name: string;
}

export async function listMyOrgs(): Promise<OrgOption[]> {
	await requireViewer();
	const h = await nextHeaders();
	const orgs = await auth.api.listOrganizations({ headers: h });
	return orgs.map((o) => ({ id: o.id, name: o.name }));
}
