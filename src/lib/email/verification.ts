import "server-only";

import { fromAddress, isConfigured, sendEmail } from "@ingram-tech/email";

/**
 * Email-verification message for Depot, sent via Cloudflare Email Sending.
 *
 * Verification is the linchpin of safe account linking: Better Auth only
 * auto-links a Google login to an existing password account when that local
 * account's email is already verified (its default `requireLocalEmailVerified`).
 * So a password account MUST prove mailbox ownership before a same-email Google
 * sign-in will merge into it — closing the "someone signed up with my address"
 * hijack. That makes this send load-bearing, not best-effort.
 *
 * When the email package isn't configured (no CLOUDFLARE_* env in local/dev) we
 * can't send — so we log the verification URL to the server console instead of
 * silently dropping it, giving a dev a clickable link to finish verifying. In
 * prod the env is wired (see stacks/depot.ts), so this always sends.
 */

export interface VerificationEmailInput {
	/** Recipient (the address being verified). */
	email: string;
	/** Display name, if known — personalises the greeting. */
	name?: string | null;
	/** Better Auth verification deep link (one-time token baked in). */
	url: string;
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

export async function sendVerificationEmail(
	input: VerificationEmailInput,
): Promise<void> {
	if (!isConfigured()) {
		console.warn(
			`[verify] email not configured; verification link for ${input.email}:\n${input.url}`,
		);
		return;
	}

	const who = input.name?.trim() || "there";
	const subject = "Verify your email for Depot";
	const url = escapeHtml(input.url);

	const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.5">
	<h1 style="font-size:20px;font-weight:600;margin:0 0 16px">Confirm your email</h1>
	<p style="margin:0 0 16px">Hi ${escapeHtml(who)}, confirm this address to finish setting up your Depot account.</p>
	<p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:500">Verify email</a></p>
	<p style="margin:0;color:#666;font-size:13px">Or paste this link into your browser:<br><a href="${url}" style="color:#666">${url}</a></p>
	<p style="margin:16px 0 0;color:#999;font-size:12px">If you didn't create a Depot account, you can ignore this email.</p>
</div>`.trim();

	const text = `Confirm your email to finish setting up your Depot account.\n\nVerify: ${input.url}\n\nIf you didn't create a Depot account, you can ignore this email.`;

	await sendEmail({
		from: fromAddress("Depot", "no-reply"),
		to: input.email,
		subject,
		html,
		text,
	});
}
