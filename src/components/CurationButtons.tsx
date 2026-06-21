"use client";

import { useState, useTransition } from "react";

import { curateEntry } from "@/lib/queries/curation";

type Action = "confirm" | "dispute" | "outdated";

const LABELS: Record<Action, string> = {
	confirm: "Confirm",
	dispute: "Dispute",
	outdated: "Mark outdated",
};

/**
 * One human confirm/dispute/outdated outranks any AI confidence. Posts to the
 * `curateEntry` server action, which writes `entry_curation` and shifts status.
 */
export function CurationButtons({ entryId }: { entryId: string }) {
	const [pending, startTransition] = useTransition();
	const [done, setDone] = useState<Action | null>(null);
	const [error, setError] = useState<string | null>(null);

	function run(action: Action) {
		setError(null);
		startTransition(async () => {
			const res = await curateEntry({ entryId, action });
			if (res.ok) {
				setDone(action);
			} else {
				setError(res.error);
			}
		});
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap gap-2">
				{(Object.keys(LABELS) as Action[]).map((action) => {
					const isDone = done === action;
					return (
						<button
							key={action}
							type="button"
							disabled={pending}
							onClick={() => run(action)}
							className="rounded-[6px] border px-3 py-1.5 font-sans text-[12px] transition-colors disabled:opacity-50"
							style={{
								borderColor: isDone
									? action === "confirm"
										? "var(--color-fresh)"
										: "var(--color-stale)"
									: "var(--color-hairline)",
								color: isDone
									? action === "confirm"
										? "var(--color-fresh)"
										: "var(--color-stale)"
									: "var(--color-muted)",
							}}
						>
							{isDone ? `✓ ${LABELS[action]}` : LABELS[action]}
						</button>
					);
				})}
			</div>
			{error && <p className="font-mono text-[11px] text-stale">{error}</p>}
			{done && !error && (
				<p className="font-mono text-[11px] text-muted">
					Recorded — your call outranks AI confidence.
				</p>
			)}
		</div>
	);
}
