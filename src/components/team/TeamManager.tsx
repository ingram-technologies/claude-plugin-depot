"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
	cancelInvite,
	changeMemberRole,
	inviteMember,
	removeMember,
	type PendingInvite,
	type TeamMember,
} from "@/app/(app)/settings/team/actions";

const ROLES = ["member", "admin", "owner"] as const;

/**
 * Client team manager. Owners/admins get invite + per-member role/remove
 * controls; members see a read-only roster. Every mutation re-validates the
 * caller's role server-side, so hiding a control is UX, not the security
 * boundary. Refreshes the server component on success.
 */
export function TeamManager({
	members,
	invitations,
	canManage,
	viewerUserId,
}: {
	members: TeamMember[];
	invitations: PendingInvite[];
	canManage: boolean;
	viewerUserId: string;
}) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<(typeof ROLES)[number]>("member");
	const [error, setError] = useState<string | null>(null);

	function submitInvite(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		startTransition(async () => {
			const res = await inviteMember({ email, role });
			if (!res.ok) {
				setError(res.error);
				return;
			}
			setEmail("");
			router.refresh();
		});
	}

	function onRemove(memberId: string) {
		setError(null);
		startTransition(async () => {
			const res = await removeMember({ memberId });
			if (!res.ok) {
				setError(res.error);
				return;
			}
			router.refresh();
		});
	}

	function onRoleChange(memberId: string, next: string) {
		setError(null);
		startTransition(async () => {
			const res = await changeMemberRole({ memberId, role: next });
			if (!res.ok) {
				setError(res.error);
				return;
			}
			router.refresh();
		});
	}

	function onCancel(invitationId: string) {
		setError(null);
		startTransition(async () => {
			const res = await cancelInvite({ invitationId });
			if (!res.ok) {
				setError(res.error);
				return;
			}
			router.refresh();
		});
	}

	return (
		<div className="flex flex-col gap-8">
			{error && <p className="font-mono text-[11px] text-stale">{error}</p>}

			<section>
				<p className="mb-2 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
					members · {members.length}
				</p>
				<ul className="overflow-hidden rounded-[8px] border border-hairline">
					{members.map((m) => {
						const isSelf = m.userId === viewerUserId;
						return (
							<li
								key={m.memberId}
								className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0"
							>
								<div className="min-w-0 flex-1">
									<div className="flex items-baseline gap-2">
										<span className="truncate font-sans text-[14px] text-ink">
											{m.name}
										</span>
										{isSelf && (
											<span className="font-mono text-[10px] text-gold">
												you
											</span>
										)}
									</div>
									<div className="truncate font-mono text-[11px] text-muted">
										{m.email}
									</div>
									<div className="font-mono text-[10px] text-muted/70">
										{m.memberId}
									</div>
								</div>
								{canManage && !isSelf ? (
									<div className="flex shrink-0 items-center gap-2">
										<select
											value={m.role}
											disabled={pending}
											onChange={(e) =>
												onRoleChange(m.memberId, e.target.value)
											}
											className="rounded-[6px] border border-hairline bg-surface/40 px-2 py-1 font-sans text-[12px] text-ink focus:border-gold focus:outline-none"
										>
											{ROLES.map((r) => (
												<option key={r} value={r}>
													{r}
												</option>
											))}
										</select>
										<button
											type="button"
											disabled={pending}
											onClick={() => onRemove(m.memberId)}
											className="font-sans text-[12px] text-muted transition-colors hover:text-stale disabled:opacity-50"
										>
											remove
										</button>
									</div>
								) : (
									<span className="shrink-0 font-mono text-[11px] text-muted">
										{m.role}
									</span>
								)}
							</li>
						);
					})}
				</ul>
			</section>

			{canManage && (
				<section>
					<p className="mb-2 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
						invite a teammate
					</p>
					<form
						onSubmit={submitInvite}
						className="flex flex-col gap-2 sm:flex-row"
					>
						<input
							type="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="teammate@company.com"
							className="flex-1 rounded-[6px] border border-hairline bg-surface/40 px-3 py-2 font-sans text-sm text-ink placeholder:text-muted focus:border-gold focus:outline-none"
						/>
						<select
							value={role}
							onChange={(e) => {
								const v = e.target.value;
								if (v === "member" || v === "admin" || v === "owner") {
									setRole(v);
								}
							}}
							className="rounded-[6px] border border-hairline bg-surface/40 px-3 py-2 font-sans text-sm text-ink focus:border-gold focus:outline-none"
						>
							{ROLES.map((r) => (
								<option key={r} value={r}>
									{r}
								</option>
							))}
						</select>
						<button
							type="submit"
							disabled={pending}
							className="rounded-[6px] border border-gold bg-gold/10 px-4 py-2 font-sans text-[13px] text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
						>
							{pending ? "…" : "Invite"}
						</button>
					</form>
				</section>
			)}

			{invitations.length > 0 && (
				<section>
					<p className="mb-2 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
						pending invitations · {invitations.length}
					</p>
					<ul className="overflow-hidden rounded-[8px] border border-hairline">
						{invitations.map((i) => (
							<li
								key={i.id}
								className="flex items-center gap-3 border-b border-hairline px-4 py-2.5 last:border-b-0"
							>
								<span className="flex-1 truncate font-sans text-[13px] text-ink/90">
									{i.email}
								</span>
								<span className="font-mono text-[11px] text-muted">
									{i.role}
								</span>
								{canManage && (
									<button
										type="button"
										disabled={pending}
										onClick={() => onCancel(i.id)}
										className="font-sans text-[12px] text-muted transition-colors hover:text-stale disabled:opacity-50"
									>
										cancel
									</button>
								)}
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	);
}
