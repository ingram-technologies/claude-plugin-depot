"use client";

import { useState } from "react";

import type { EvidenceRow } from "@/lib/queries/types";

function fmtDate(d: Date | null): string {
	if (!d) {
		return "unknown date";
	}
	return new Intl.DateTimeFormat("en", {
		year: "numeric",
		month: "short",
		day: "2-digit",
	}).format(d);
}

function shortModel(m: string | null): string {
	if (!m) {
		return "model?";
	}
	// claude-opus-4-8[1m] → opus-4-8
	return m
		.replace(/^claude-/, "")
		.replace(/^(us|eu)\.anthropic\./, "")
		.replace(/\[.*\]$/, "");
}

/**
 * The Evidence block — provenance is the admission requirement. Each row is one
 * source record: `session <date> · <model> · "quote" →`. Clicking expands the
 * record's full textContent inline (mono, gold left-border).
 *
 * Provenance hover-illumination: the parent reading view sets `raised` (driven
 * by hovering the claim) — raised rows brighten their gold left-border while
 * the rest dim. Hovering a single row also raises just that one.
 */
export function EvidenceBlock({
	evidence,
	raised,
}: {
	evidence: EvidenceRow[];
	raised: boolean;
}) {
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const [hovered, setHovered] = useState<string | null>(null);

	function toggle(id: string) {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}

	if (evidence.length === 0) {
		return (
			<p className="font-mono text-[12px] text-stale">
				No provenance on record — this should not happen.
			</p>
		);
	}

	return (
		<div className="evidence-group flex flex-col gap-px">
			{evidence.map((ev) => {
				const isOpen = expanded.has(ev.id);
				const isRaised = raised || hovered === ev.id;
				return (
					<div
						key={ev.id}
						className="evidence-row rounded-[6px] border border-hairline bg-surface/40"
						data-raised={isRaised ? "true" : "false"}
						onMouseEnter={() => setHovered(ev.id)}
						onMouseLeave={() => setHovered(null)}
					>
						<button
							type="button"
							onClick={() => toggle(ev.id)}
							className="flex w-full items-start gap-2 px-3 py-2 text-left"
						>
							<span className="font-mono text-[11px] text-muted whitespace-nowrap">
								session {fmtDate(ev.sessionDate)}
							</span>
							<span className="font-mono text-[11px] text-muted">·</span>
							<span className="font-mono text-[11px] text-gold/80">
								{shortModel(ev.model)}
							</span>
							{ev.quote && (
								<span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink/80 italic">
									“{ev.quote}”
								</span>
							)}
							<span className="ml-auto shrink-0 font-mono text-[11px] text-gold">
								{isOpen ? "↑" : "→"}
							</span>
						</button>

						{isOpen && (
							<pre
								className="mx-3 mb-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-[6px] border-l-2 border-gold bg-bg px-3 py-2 font-mono text-[11px] leading-relaxed text-ink/85"
								style={{ borderColor: "var(--color-gold)" }}
							>
								{ev.textContent ?? "(source record text unavailable)"}
								{"\n\n"}
								<span className="text-muted">
									record {ev.recordUuid}
								</span>
							</pre>
						)}
					</div>
				);
			})}
		</div>
	);
}
