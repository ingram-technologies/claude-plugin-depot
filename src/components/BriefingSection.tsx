import { Markdown } from "@/components/Markdown";
import { shortAgo } from "@/lib/queries/freshness";
import type { BriefingView } from "@/lib/queries/types";

/**
 * The hook, surfaced prominently: the cited per-project briefing rendered from
 * markdown into the editorial register. Framed like a printed brief.
 */
export function BriefingSection({ briefing }: { briefing: BriefingView | null }) {
	if (!briefing) {
		return (
			<section className="rounded-[8px] border border-dashed border-hairline px-5 py-8">
				<p className="font-mono text-[11px] tracking-[0.14em] text-gold/80 uppercase">
					the brief
				</p>
				<p className="mt-2 font-serif text-[15px] text-muted italic">
					No briefing generated yet. It appears once enough Memories have been
					distilled.
				</p>
			</section>
		);
	}

	return (
		<section className="rounded-[8px] border border-hairline bg-surface/30 px-6 py-6">
			<div className="mb-3 flex items-baseline justify-between">
				<p className="font-mono text-[11px] tracking-[0.14em] text-gold/80 uppercase">
					the brief
				</p>
				<p className="font-mono text-[10px] text-muted">
					{briefing.entryCountAtGen ?? "—"} memories · generated{" "}
					{shortAgo(briefing.createdAt)}
				</p>
			</div>
			<div className="measure">
				<Markdown source={briefing.content} />
			</div>
		</section>
	);
}
