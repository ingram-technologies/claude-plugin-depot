"use client";

import { useState, useTransition } from "react";

import { mintPersonalToken } from "@/app/(app)/onboarding/actions";
import { CopyField } from "@/components/CopyField";

/**
 * Personal-token step. Calls the server action that mints a token bound to the
 * viewer + active org and shows the raw value ONCE, in a copy box with a
 * can't-see-it-again warning. The minted token is also lifted up so the plugin
 * step below can pre-fill it into the DEPOT_TOKEN export.
 */
export function MintToken({ onMinted }: { onMinted?: (token: string) => void }) {
	const [pending, startTransition] = useTransition();
	const [token, setToken] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	function mint() {
		setError(null);
		startTransition(async () => {
			const res = await mintPersonalToken();
			if (!res.ok) {
				setError(res.error);
				return;
			}
			setToken(res.token);
			onMinted?.(res.token);
		});
	}

	if (token) {
		return (
			<div className="flex flex-col gap-3">
				<CopyField value={token} label="DEPOT_TOKEN" />
				<div
					className="rounded-[6px] border px-3 py-2 font-sans text-[12px]"
					style={{
						borderColor: "var(--color-stale)",
						color: "var(--color-stale)",
						background: "color-mix(in srgb, var(--color-stale) 8%, transparent)",
					}}
				>
					Copy this now — it's shown only once. Depot stores only a hash; we can't show it again.
					Lost it? Mint a new one in API tokens.
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			<p className="font-serif text-[15px] leading-relaxed text-ink/90">
				Mint a personal ingest token. It attributes everything you sync to you, inside this
				organization.
			</p>
			<div>
				<button
					type="button"
					onClick={mint}
					disabled={pending}
					className="rounded-[6px] border border-gold bg-gold/10 px-4 py-2 font-sans text-[13px] text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
				>
					{pending ? "Minting…" : "Mint my token"}
				</button>
			</div>
			{error && <p className="font-mono text-[11px] text-stale">{error}</p>}
		</div>
	);
}
