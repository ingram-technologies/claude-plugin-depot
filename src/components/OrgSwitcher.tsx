"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { listMyOrgs, type OrgOption } from "@/app/(app)/actions";
import { authClient } from "@/lib/auth-client";

/**
 * Org switcher for the sidebar. Shows the active org; opens a popover listing
 * the viewer's orgs (lazy-loaded on first open via `listMyOrgs`). Switching
 * sets the active org cookie with `authClient.organization.setActive`, then
 * refreshes so the server re-resolves the tenant for every scoped query.
 */
export function OrgSwitcher({
	activeOrgId,
	activeOrgName,
}: {
	activeOrgId: string;
	activeOrgName: string;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [orgs, setOrgs] = useState<OrgOption[] | null>(null);
	const [pending, startTransition] = useTransition();
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function onClick(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		window.addEventListener("mousedown", onClick);
		return () => window.removeEventListener("mousedown", onClick);
	}, []);

	async function toggle() {
		const next = !open;
		setOpen(next);
		if (next && orgs === null) {
			const list = await listMyOrgs();
			setOrgs(list);
		}
	}

	function pick(orgId: string) {
		if (orgId === activeOrgId) {
			setOpen(false);
			return;
		}
		startTransition(async () => {
			await authClient.organization.setActive({ organizationId: orgId });
			setOpen(false);
			router.refresh();
		});
	}

	return (
		<div ref={ref} className="relative px-2 pt-3">
			<button
				type="button"
				onClick={toggle}
				disabled={pending}
				className="flex w-full items-center justify-between gap-2 rounded-[6px] border border-hairline bg-surface/40 px-2.5 py-1.5 text-left transition-colors hover:bg-surface disabled:opacity-50"
			>
				<span className="min-w-0">
					<span className="block font-mono text-[9px] tracking-[0.14em] text-muted uppercase">
						org
					</span>
					<span className="block truncate font-sans text-[13px] text-ink">
						{activeOrgName}
					</span>
				</span>
				<span className="font-mono text-[10px] text-muted">
					{open ? "▴" : "▾"}
				</span>
			</button>

			{open && (
				<div className="absolute right-2 left-2 z-30 mt-1 overflow-hidden rounded-[6px] border border-hairline bg-surface shadow-lg">
					{orgs === null ? (
						<p className="px-3 py-2 font-mono text-[11px] text-muted">
							loading…
						</p>
					) : orgs.length === 0 ? (
						<p className="px-3 py-2 font-mono text-[11px] text-muted">
							no orgs
						</p>
					) : (
						<ul className="py-1">
							{orgs.map((o) => {
								const active = o.id === activeOrgId;
								return (
									<li key={o.id}>
										<button
											type="button"
											onClick={() => pick(o.id)}
											className="flex w-full items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-bg"
										>
											<span
												className="truncate font-sans text-[13px]"
												style={{
													color: active
														? "var(--color-gold)"
														: "var(--color-ink)",
												}}
											>
												{o.name}
											</span>
											{active && (
												<span className="font-mono text-[10px] text-gold">
													●
												</span>
											)}
										</button>
									</li>
								);
							})}
						</ul>
					)}
					<div className="border-t border-hairline">
						<a
							href="/onboarding?step=org"
							className="block px-3 py-1.5 font-sans text-[12px] text-muted transition-colors hover:text-gold"
						>
							+ New organization
						</a>
					</div>
				</div>
			)}
		</div>
	);
}
