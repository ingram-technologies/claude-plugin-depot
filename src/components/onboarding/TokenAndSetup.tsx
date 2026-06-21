"use client";

import Link from "next/link";
import { useState } from "react";

import { MintToken } from "@/components/onboarding/MintToken";
import { PluginSetup } from "@/components/onboarding/PluginSetup";
import { OnboardingSection } from "@/components/onboarding/OnboardingSection";

/**
 * The post-org part of onboarding: mint a personal token, then wire up the
 * plugin. Stateful so the just-minted token (kept only in memory) pre-fills the
 * DEPOT_TOKEN export below. Re-enterable — minting again just shows a fresh one.
 */
export function TokenAndSetup({ depotUrl }: { depotUrl: string }) {
	const [token, setToken] = useState<string | null>(null);

	return (
		<div className="flex flex-col gap-10">
			<OnboardingSection step="2" title="Your personal ingest token">
				<MintToken onMinted={setToken} />
			</OnboardingSection>

			<OnboardingSection step="3" title="Install the plugin & sync">
				<PluginSetup token={token} depotUrl={depotUrl} />
			</OnboardingSection>

			<div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-6">
				<Link
					href="/"
					className="rounded-[6px] border border-gold bg-gold/10 px-4 py-2 font-sans text-[13px] text-gold transition-colors hover:bg-gold/20"
				>
					Done — take me to my projects
				</Link>
				<Link
					href="/tokens"
					className="font-sans text-[12px] text-muted transition-colors hover:text-gold"
				>
					Manage tokens
				</Link>
			</div>
		</div>
	);
}
