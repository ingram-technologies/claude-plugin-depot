"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { authClient } from "@/lib/auth-client";

/**
 * Invitation-accept step. The org name may be unknown (the invite id is all we
 * carry in the URL); accepting sets the new org active and continues into the
 * token step. Reject sends the user to org-create instead.
 */
export function AcceptInvite({ invitationId }: { invitationId: string }) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function accept() {
		setError(null);
		startTransition(async () => {
			const res = await authClient.organization.acceptInvitation({
				invitationId,
			});
			if (res.error) {
				setError(res.error.message ?? "Could not accept the invitation.");
				return;
			}
			const orgId = res.data?.invitation?.organizationId;
			if (orgId) {
				await authClient.organization.setActive({ organizationId: orgId });
			}
			router.replace("/onboarding?step=token");
			router.refresh();
		});
	}

	function reject() {
		setError(null);
		startTransition(async () => {
			await authClient.organization.rejectInvitation({ invitationId });
			router.replace("/onboarding?step=org");
			router.refresh();
		});
	}

	return (
		<div className="flex flex-col gap-4">
			<p className="font-serif text-[15px] leading-relaxed text-ink/90">
				You've been invited to join an organization on Depot. Accept to start contributing your
				sessions to its institutional memory.
			</p>
			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					onClick={accept}
					disabled={pending}
					className="rounded-[6px] border border-gold bg-gold/10 px-4 py-2 font-sans text-[13px] text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
				>
					{pending ? "Accepting…" : "Accept invitation"}
				</button>
				<button
					type="button"
					onClick={reject}
					disabled={pending}
					className="rounded-[6px] border border-hairline px-4 py-2 font-sans text-[13px] text-muted transition-colors hover:text-stale disabled:opacity-50"
				>
					Decline
				</button>
			</div>
			{error && <p className="font-mono text-[11px] text-stale">{error}</p>}
		</div>
	);
}
