import { FeedItem } from "@/components/FeedItem";
import { PageHeader } from "@/components/PageHeader";
import { feed } from "@/lib/queries";

export default async function FeedPage() {
	const items = await feed({ limit: 60 });

	return (
		<div className="mx-auto max-w-3xl px-6 py-8">
			<PageHeader
				eyebrow="feed"
				title="Recently distilled"
				blurb="Newly-learned and materially-changed Memories across every project."
			/>

			{items.length === 0 ? (
				<EmptyFeed />
			) : (
				<ul className="mt-6 overflow-hidden rounded-[8px] border border-hairline border-b-0">
					{items.map((entry) => (
						<FeedItem key={entry.id} entry={entry} />
					))}
				</ul>
			)}
		</div>
	);
}

function EmptyFeed() {
	return (
		<div className="mt-10 rounded-[8px] border border-dashed border-hairline px-6 py-16 text-center">
			<p className="font-serif text-lg text-ink">No memories yet.</p>
			<p className="mt-2 font-sans text-sm text-muted">
				Once sessions are ingested and analyzed, the distillations will appear
				here.
			</p>
			<p className="mt-4 font-mono text-[11px] text-muted">
				transcripts → extract → canonicalize → brief
			</p>
		</div>
	);
}
