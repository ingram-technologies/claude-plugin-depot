import Link from "next/link";

import { ConfidenceDot } from "@/components/ConfidenceDot";
import { EntryTypeTag } from "@/components/EntryTypeTag";
import { freshnessBucket, isLiveEdge, shortAgo } from "@/lib/queries/freshness";
import type { EntrySummary } from "@/lib/queries/types";

/**
 * Linear-dense row for the typed entry list on the project page. ~36px,
 * confidence dot in the left margin, serif claim, mono freshness.
 */
export function EntryRow({
	entry,
	showType = true,
}: {
	entry: EntrySummary;
	showType?: boolean;
}) {
	const bucket = freshnessBucket(entry.lastSeenAt, entry.confidence);
	const live = isLiveEdge(entry.updatedAt);

	return (
		<li className={live ? "live-edge" : ""}>
			<Link
				href={`/m/${entry.id}`}
				className="group flex items-center gap-3 border-b border-hairline px-3 py-2 transition-colors hover:bg-surface/60"
			>
				<ConfidenceDot bucket={bucket} size={7} />
				<span className="min-w-0 flex-1 truncate font-serif text-[14px] text-ink group-hover:text-gold">
					{entry.claim}
				</span>
				{showType && (
					<span className="shrink-0">
						<EntryTypeTag type={entry.entryType} />
					</span>
				)}
				<span className="shrink-0 font-mono text-[10px] text-muted tabular-nums">
					{shortAgo(entry.lastSeenAt)}
				</span>
			</Link>
		</li>
	);
}
