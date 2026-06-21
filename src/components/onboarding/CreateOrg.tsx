"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { authClient } from "@/lib/auth-client";

/** Slug from a name: lowercase, alphanumerics → hyphens, trimmed. */
function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
}

/**
 * Org-create step. The creator becomes owner automatically. On success the new
 * org is set active and we advance to the token step.
 */
export function CreateOrg() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [pending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function submit(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = name.trim();
		if (trimmed.length === 0) {
			setError("Give your organization a name.");
			return;
		}
		const slug = slugify(trimmed);
		if (slug.length === 0) {
			setError("Use at least one letter or number in the name.");
			return;
		}
		setError(null);
		startTransition(async () => {
			const res = await authClient.organization.create({ name: trimmed, slug });
			if (res.error) {
				setError(res.error.message ?? "Could not create the organization.");
				return;
			}
			const orgId = res.data?.id;
			if (orgId) {
				await authClient.organization.setActive({ organizationId: orgId });
			}
			router.replace("/onboarding?step=token");
			router.refresh();
		});
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-3">
			<label className="flex flex-col gap-1">
				<span className="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
					organization name
				</span>
				<input
					value={name}
					onChange={(e) => setName(e.target.value)}
					autoFocus
					placeholder="Acme Robotics"
					className="w-full rounded-[6px] border border-hairline bg-surface/40 px-3 py-2 font-sans text-sm text-ink placeholder:text-muted focus:border-gold focus:outline-none"
				/>
			</label>
			{name.trim() && (
				<p className="font-mono text-[11px] text-muted">
					slug: <span className="text-ink/80">{slugify(name)}</span>
				</p>
			)}
			<div>
				<button
					type="submit"
					disabled={pending}
					className="rounded-[6px] border border-gold bg-gold/10 px-4 py-2 font-sans text-[13px] text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
				>
					{pending ? "Creating…" : "Create organization"}
				</button>
			</div>
			{error && <p className="font-mono text-[11px] text-stale">{error}</p>}
			<p className="font-sans text-[12px] text-muted">
				You'll be the owner. Invite teammates afterward from Settings → Team.
			</p>
		</form>
	);
}
