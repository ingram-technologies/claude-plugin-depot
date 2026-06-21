"use client";

import { useMemo, useState } from "react";

import { EntryRow } from "@/components/EntryRow";
import type { EntrySummary, EntryType } from "@/lib/queries/types";

type Filter = "all" | EntryType;

const CHIPS: { id: Filter; label: string }[] = [
	{ id: "all", label: "All" },
	{ id: "decision", label: "Decisions" },
	{ id: "gotcha", label: "Gotchas" },
	{ id: "principle", label: "Principles" },
	{ id: "state", label: "State" },
];

/**
 * The dense typed entry list with sticky filter chips. Client-side because the
 * chips filter an already-loaded list (cheap, instant; no round-trip).
 */
export function EntryFilterList({ entries }: { entries: EntrySummary[] }) {
	const [filter, setFilter] = useState<Filter>("all");

	const counts = useMemo(() => {
		const c: Record<Filter, number> = {
			all: entries.length,
			decision: 0,
			gotcha: 0,
			principle: 0,
			state: 0,
		};
		for (const e of entries) {
			c[e.entryType]++;
		}
		return c;
	}, [entries]);

	const shown = useMemo(
		() =>
			filter === "all"
				? entries
				: entries.filter((e) => e.entryType === filter),
		[entries, filter],
	);

	return (
		<div>
			<div className="sticky top-[57px] z-10 -mx-1 flex flex-wrap gap-1.5 bg-bg/90 px-1 py-2 backdrop-blur">
				{CHIPS.map((chip) => {
					const active = filter === chip.id;
					return (
						<button
							key={chip.id}
							type="button"
							onClick={() => setFilter(chip.id)}
							className="rounded-[6px] border px-2.5 py-1 font-sans text-[12px] transition-colors"
							style={{
								borderColor: active
									? "var(--color-gold)"
									: "var(--color-hairline)",
								color: active ? "var(--color-gold)" : "var(--color-muted)",
								background: active
									? "color-mix(in srgb, var(--color-gold) 8%, transparent)"
									: "transparent",
							}}
						>
							{chip.label}
							<span className="ml-1.5 font-mono text-[10px] opacity-70 tabular-nums">
								{counts[chip.id]}
							</span>
						</button>
					);
				})}
			</div>

			{shown.length === 0 ? (
				<p className="px-3 py-6 font-sans text-sm text-muted">
					Nothing of this type yet.
				</p>
			) : (
				<ul className="overflow-hidden rounded-[8px] border border-hairline border-b-0">
					{shown.map((entry) => (
						<EntryRow key={entry.id} entry={entry} showType={filter === "all"} />
					))}
				</ul>
			)}
		</div>
	);
}
