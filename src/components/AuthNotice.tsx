"use client";

import { useSearchParams } from "next/navigation";

/**
 * Surfaces auth redirect outcomes that Better Auth signals via the query string
 * (e.g. a social sign-in that bounced back to `/sign-in?error=account_not_linked`).
 * Without this the user just lands back on the form with no explanation.
 *
 * Codes arrive in either Better-Auth's snake_case (social callback redirects)
 * or SCREAMING_SNAKE (thrown API error codes), so we normalise before matching.
 */
const MESSAGES: Record<string, string> = {
	account_not_linked:
		"This email already has a password account that hasn't been verified yet. " +
		"Sign in with your password once (we'll email you a verification link), then " +
		"Google will link automatically.",
	email_not_verified:
		"Almost there — check your inbox for a verification link to finish signing in.",
	signup_disabled: "New accounts are invite-only right now.",
	invalid_token: "That verification link is invalid or has expired. Try signing in to get a fresh one.",
	token_expired: "That verification link has expired. Sign in to get a fresh one.",
};

export function AuthNotice() {
	const params = useSearchParams();
	const raw = params.get("error") ?? params.get("message");
	if (!raw) return null;

	const code = raw.toLowerCase();
	const message =
		MESSAGES[code] ?? "Something went wrong while signing you in. Please try again.";

	return (
		<div
			role="alert"
			className="mb-4 rounded-[6px] border border-stale/40 bg-stale/5 px-3 py-2 font-sans text-[12px] leading-relaxed text-stale"
		>
			{message}
		</div>
	);
}
