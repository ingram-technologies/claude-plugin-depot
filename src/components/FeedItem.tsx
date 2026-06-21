import Link from "next/link";

import { ConfidenceDot } from "@/components/ConfidenceDot";
import { EntryTypeTag } from "@/components/EntryTypeTag";
import { ProjectChip } from "@/components/ProjectChip";
import { freshnessBucket, isLiveEdge, shortAgo } from "@/lib/queries/freshness";
import type { EntrySummary } from "@/lib/queries/types";

/**
 * A feed row: project chip + type tag + the serif claim + trust/freshness. The
 * live-edge gold rule marks very recently changed Memories.
 */
export function FeedItem({ entry }: { entry: EntrySummary }) {
	const bucket = freshnessBucket(entry.lastSeenAt, entry.confidence);
	const live = isLiveEdge(entry.updatedAt);

	return (
		<li className={`group border-b border-hairline ${live ? "live-edge" : ""}`}>
			<Link
				href={`/m/${entry.id}`}
				className="flex gap-3 px-4 py-3 transition-colors hover:bg-surface/60"
			>
				<span className="mt-2 shrink-0">
					<ConfidenceDot bucket={bucket} />
				</span>
				<div className="min-w-0 flex-1">
					<div className="mb-1 flex items-center gap-2">
						<ProjectChip slug={entry.projectSlug} />
						<EntryTypeTag type={entry.entryType} />
					</div>
					<p className="font-serif text-[15px] leading-snug text-ink group-hover:text-gold">
						{entry.claim}
					</p>
					<p className="mt-1 font-mono text-[11px] text-muted">
						seen in {entry.sessionCount}{" "}
						{entry.sessionCount === 1 ? "session" : "sessions"} ·{" "}
						{shortAgo(entry.lastSeenAt)} · confidence{" "}
						{entry.confidence.toFixed(2)}
					</p>
				</div>
			</Link>
		</li>
	);
}
