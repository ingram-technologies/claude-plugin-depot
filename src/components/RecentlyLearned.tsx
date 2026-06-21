import Link from "next/link";

import { EntryTypeTag } from "@/components/EntryTypeTag";
import { shortAgo } from "@/lib/queries/freshness";
import type { EntrySummary } from "@/lib/queries/types";

/** Right-rail "recently learned" — every item carries the gold live-edge rule. */
export function RecentlyLearned({ entries }: { entries: EntrySummary[] }) {
	if (entries.length === 0) {
		return null;
	}
	return (
		<aside>
			<p className="mb-2 font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
				recently learned
			</p>
			<ul className="flex flex-col gap-2">
				{entries.map((e) => (
					<li key={e.id} className="live-edge rounded-r-[6px] bg-surface/30">
						<Link
							href={`/m/${e.id}`}
							className="group block py-1.5 pr-2 pl-3"
						>
							<div className="mb-0.5">
								<EntryTypeTag type={e.entryType} />
							</div>
							<p className="font-serif text-[13px] leading-snug text-ink group-hover:text-gold">
								{e.claim}
							</p>
							<p className="mt-0.5 font-mono text-[10px] text-muted">
								{shortAgo(e.updatedAt)}
							</p>
						</Link>
					</li>
				))}
			</ul>
		</aside>
	);
}
