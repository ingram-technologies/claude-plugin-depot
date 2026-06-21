"use server";

import { headers as nextHeaders } from "next/headers";
import { z } from "zod";

import { requireViewer } from "@/lib/auth-helpers";
import { auth } from "@/lib/auth";

/**
 * Team-management server actions. Each one re-resolves the viewer + active org
 * server-side and gates by role, so a member can never mutate by replaying an
 * admin's request. Returns plain `{ ok }` results — never throws to the client.
 */

const ROLES = ["member", "admin", "owner"] as const;
const roleSchema = z.enum(ROLES);

export interface TeamMember {
	memberId: string;
	userId: string;
	name: string;
	email: string;
	role: string;
}

export interface PendingInvite {
	id: string;
	email: string;
	role: string;
	status: string;
}

export interface TeamSnapshot {
	orgId: string;
	orgName: string;
	viewerRole: string;
	viewerUserId: string;
	members: TeamMember[];
	invitations: PendingInvite[];
}

type ActionResult = { ok: true } | { ok: false; error: string };

function canManage(role: string): boolean {
	return role === "owner" || role === "admin";
}

/** Load members + pending invites for the viewer's active org. */
export async function loadTeam(): Promise<TeamSnapshot | null> {
	const viewer = await requireViewer();
	if (!viewer.activeOrg) {
		return null;
	}
	const h = await nextHeaders();
	const full = await auth.api.getFullOrganization({
		headers: h,
		query: { organizationId: viewer.activeOrg.id },
	});
	if (!full) {
		return null;
	}

	const members: TeamMember[] = (full.members ?? []).map((m) => ({
		memberId: m.id,
		userId: m.userId,
		name: m.user?.name ?? m.user?.email ?? "—",
		email: m.user?.email ?? "—",
		role: m.role,
	}));

	const invitations: PendingInvite[] = (full.invitations ?? [])
		.filter((i) => i.status === "pending")
		.map((i) => ({
			id: i.id,
			email: i.email,
			role: i.role ?? "member",
			status: i.status,
		}));

	return {
		orgId: viewer.activeOrg.id,
		orgName: viewer.activeOrg.name,
		viewerRole: viewer.activeOrg.role,
		viewerUserId: viewer.user.id,
		members,
		invitations,
	};
}

const inviteSchema = z.object({
	email: z.string().email().max(254),
	role: roleSchema,
});

export async function inviteMember(input: unknown): Promise<ActionResult> {
	const parsed = inviteSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "Enter a valid email and role." };
	}
	const viewer = await requireViewer();
	if (!viewer.activeOrg || !canManage(viewer.activeOrg.role)) {
		return { ok: false, error: "Only owners and admins can invite." };
	}
	const h = await nextHeaders();
	try {
		await auth.api.createInvitation({
			headers: h,
			body: {
				email: parsed.data.email,
				role: parsed.data.role,
				organizationId: viewer.activeOrg.id,
			},
		});
		return { ok: true };
	} catch {
		return { ok: false, error: "Could not send the invitation." };
	}
}

const cancelSchema = z.object({ invitationId: z.string().min(1).max(128) });

export async function cancelInvite(input: unknown): Promise<ActionResult> {
	const parsed = cancelSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "Bad request." };
	}
	const viewer = await requireViewer();
	if (!viewer.activeOrg || !canManage(viewer.activeOrg.role)) {
		return { ok: false, error: "Only owners and admins can cancel invites." };
	}
	const h = await nextHeaders();
	try {
		await auth.api.cancelInvitation({
			headers: h,
			body: { invitationId: parsed.data.invitationId },
		});
		return { ok: true };
	} catch {
		return { ok: false, error: "Could not cancel the invitation." };
	}
}

const removeSchema = z.object({ memberId: z.string().min(1).max(128) });

export async function removeMember(input: unknown): Promise<ActionResult> {
	const parsed = removeSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "Bad request." };
	}
	const viewer = await requireViewer();
	if (!viewer.activeOrg || !canManage(viewer.activeOrg.role)) {
		return { ok: false, error: "Only owners and admins can remove members." };
	}
	const h = await nextHeaders();
	try {
		await auth.api.removeMember({
			headers: h,
			body: {
				memberIdOrEmail: parsed.data.memberId,
				organizationId: viewer.activeOrg.id,
			},
		});
		return { ok: true };
	} catch {
		return { ok: false, error: "Could not remove the member." };
	}
}

const roleChangeSchema = z.object({
	memberId: z.string().min(1).max(128),
	role: roleSchema,
});

export async function changeMemberRole(input: unknown): Promise<ActionResult> {
	const parsed = roleChangeSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "Bad request." };
	}
	const viewer = await requireViewer();
	if (!viewer.activeOrg || !canManage(viewer.activeOrg.role)) {
		return { ok: false, error: "Only owners and admins can change roles." };
	}
	const h = await nextHeaders();
	try {
		await auth.api.updateMemberRole({
			headers: h,
			body: {
				memberId: parsed.data.memberId,
				role: parsed.data.role,
				organizationId: viewer.activeOrg.id,
			},
		});
		return { ok: true };
	} catch {
		return { ok: false, error: "Could not change the role." };
	}
}
