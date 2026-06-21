"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { mintToken, revokeToken } from "@/app/(app)/tokens/actions";
import { CopyField } from "@/components/CopyField";

export interface TokenView {
	id: string;
	label: string | null;
	createdAt: string;
	lastUsedAt: string | null;
	revokedAt: string | null;
}

function fmt(iso: string | null): string {
	if (!iso) {
		return "—";
	}
	return new Date(iso).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

/**
 * Personal ingest-token manager. Lists the viewer's tokens, mints new ones
 * (showing the raw value once), and revokes. Mutations re-validate ownership
 * server-side; the list is re-fetched via router.refresh.
 */
export function TokenManager({ tokens }: { tokens: TokenView[] }) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [label, setLabel] = useState("");
	const [fresh, setFresh] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	function onMint(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setFresh(null);
		startTransition(async () => {
			const res = await mintToken({ label });
			if (!res.ok) {
				setError(res.error);
				return;
			}
			setFresh(res.token);
			setLabel("");
			router.refresh();
		});
	}

	function onRevoke(tokenId: string) {
		setError(null);
		startTransition(async () => {
			const res = await revokeToken({ tokenId });
			if (!res.ok) {
				setError(res.error);
				return;
			}
			router.refresh();
		});
	}

	return (
		<div className="flex flex-col gap-8">
			<section>
				<p className="mb-2 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
					generate a token
				</p>
				<form onSubmit={onMint} className="flex flex-col gap-2 sm:flex-row">
					<input
						value={label}
						onChange={(e) => setLabel(e.target.value)}
						placeholder="label (optional, e.g. laptop)"
						maxLength={80}
						className="flex-1 rounded-[6px] border border-hairline bg-surface/40 px-3 py-2 font-sans text-sm text-ink placeholder:text-muted focus:border-gold focus:outline-none"
					/>
					<button
						type="submit"
						disabled={pending}
						className="rounded-[6px] border border-gold bg-gold/10 px-4 py-2 font-sans text-[13px] text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
					>
						{pending ? "…" : "Generate"}
					</button>
				</form>
				{error && (
					<p className="mt-2 font-mono text-[11px] text-stale">{error}</p>
				)}

				{fresh && (
					<div className="mt-3 flex flex-col gap-2">
						<CopyField value={fresh} label="DEPOT_TOKEN" />
						<div
							className="rounded-[6px] border px-3 py-2 font-sans text-[12px]"
							style={{
								borderColor: "var(--color-stale)",
								color: "var(--color-stale)",
								background:
									"color-mix(in srgb, var(--color-stale) 8%, transparent)",
							}}
						>
							Copy it now — shown only once. See{" "}
							<a href="/onboarding" className="underline">
								onboarding
							</a>{" "}
							for plugin setup.
						</div>
					</div>
				)}
			</section>

			<section>
				<p className="mb-2 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
					your tokens · {tokens.length}
				</p>
				{tokens.length === 0 ? (
					<p className="rounded-[8px] border border-dashed border-hairline px-4 py-8 text-center font-sans text-sm text-muted">
						No tokens yet. Generate one above to start syncing.
					</p>
				) : (
					<ul className="overflow-hidden rounded-[8px] border border-hairline">
						{tokens.map((t) => {
							const revoked = Boolean(t.revokedAt);
							return (
								<li
									key={t.id}
									className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0"
									style={revoked ? { opacity: 0.55 } : undefined}
								>
									<div className="min-w-0 flex-1">
										<div className="flex items-baseline gap-2">
											<span className="truncate font-sans text-[14px] text-ink">
												{t.label ?? "untitled"}
											</span>
											{revoked && (
												<span className="font-mono text-[10px] text-stale">
													revoked
												</span>
											)}
										</div>
										<div className="font-mono text-[10px] text-muted/70">
											{t.id}
										</div>
										<div className="font-mono text-[10px] text-muted">
											created {fmt(t.createdAt)} · last used{" "}
											{fmt(t.lastUsedAt)}
										</div>
									</div>
									{!revoked && (
										<button
											type="button"
											disabled={pending}
											onClick={() => onRevoke(t.id)}
											className="shrink-0 font-sans text-[12px] text-muted transition-colors hover:text-stale disabled:opacity-50"
										>
											revoke
										</button>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</section>
		</div>
	);
}
