import "server-only";

import { fromAddress, isConfigured, sendEmail } from "@ingram-tech/email";

/**
 * Org-invitation email for Depot, sent via Cloudflare Email Sending.
 *
 * Best-effort by contract: it never throws into the auth flow. When the email
 * package isn't configured (no CLOUDFLARE_* env in local/dev) it no-ops with a
 * log — the invitation row still exists, so the invitee can accept it in-app via
 * /onboarding. Any send failure is caught and logged, never propagated, so a
 * mail outage can't roll back the invitation.
 */

export interface InvitationEmailInput {
	/** Better Auth invitation id — the deep link accepts this exact invite. */
	invitationId: string;
	/** Recipient (the invited address). */
	email: string;
	/** Organization the invitee is being asked to join. */
	organizationName: string;
	/** Role they'll be granted (member, admin, …). */
	role: string;
	/** Display name or email of whoever sent the invite, if known. */
	invitedByName?: string | null;
}

const escapeHtml = (s: string): string =>
	s.replace(
		/[&<>"']/g,
		(c) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;",
			})[c] ?? c,
	);

/**
 * App origin for invite deep links. Prefers the explicit Better Auth / public
 * URL, falling back to localhost so dev links still resolve.
 */
function appOrigin(): string {
	const raw =
		process.env.BETTER_AUTH_URL ??
		process.env.NEXT_PUBLIC_APP_URL ??
		"http://localhost:3000";
	return raw.replace(/\/+$/, "");
}

export async function sendInvitationEmail(input: InvitationEmailInput): Promise<void> {
	try {
		if (!isConfigured()) {
			console.warn(
				`[invite] email not configured; skipping notification to ${input.email}`,
			);
			return;
		}

		const acceptUrl = `${appOrigin()}/onboarding?invitation=${encodeURIComponent(
			input.invitationId,
		)}`;
		const inviter = input.invitedByName?.trim() || "A teammate";
		const subject = `${inviter} invited you to ${input.organizationName} on Depot`;
		const org = escapeHtml(input.organizationName);

		const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.5">
	<h1 style="font-size:20px;font-weight:600;margin:0 0 16px">You're invited to ${org}</h1>
	<p style="margin:0 0 16px">${escapeHtml(inviter)} invited you to join <strong>${org}</strong> on Depot as <strong>${escapeHtml(input.role)}</strong>.</p>
	<p style="margin:0 0 24px"><a href="${acceptUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:500">Accept invitation</a></p>
	<p style="margin:0;color:#666;font-size:13px">Or paste this link into your browser:<br><a href="${acceptUrl}" style="color:#666">${acceptUrl}</a></p>
</div>`.trim();

		const text = `${inviter} invited you to join ${input.organizationName} on Depot as ${input.role}.\n\nAccept: ${acceptUrl}`;

		await sendEmail({
			from: fromAddress("Depot", "invites"),
			to: input.email,
			subject,
			html,
			text,
		});
	} catch (err) {
		console.error("[invite] email send failed", err);
	}
}
