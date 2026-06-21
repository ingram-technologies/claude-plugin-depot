"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { signIn } from "@/lib/auth-client";

/**
 * "Continue with Google" — kicks off Better Auth's social sign-in. On success
 * Google redirects back through <site>/auth/callback/google and Better Auth
 * sends the user on to `callbackURL`.
 */
export function GoogleSignInButton() {
	const params = useSearchParams();
	const next = params.get("next") ?? "/";
	const [busy, setBusy] = useState(false);

	async function onClick() {
		setBusy(true);
		try {
			await signIn.social({ provider: "google", callbackURL: next });
		} catch {
			setBusy(false);
		}
	}

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={busy}
			className="flex w-full items-center justify-center gap-2 rounded-[6px] border border-hairline bg-surface px-4 py-2 font-sans text-[13px] text-ink transition-colors hover:bg-hairline/40 disabled:opacity-50"
		>
			<GoogleMark />
			{busy ? "…" : "Continue with Google"}
		</button>
	);
}

const GoogleMark: React.FC = () => (
	<svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
		<path
			fill="#4285F4"
			d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62Z"
		/>
		<path
			fill="#34A853"
			d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
		/>
		<path
			fill="#FBBC05"
			d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
		/>
		<path
			fill="#EA4335"
			d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
		/>
	</svg>
);
