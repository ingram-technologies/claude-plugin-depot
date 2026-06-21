import { z } from "zod";

import { FeedItem } from "@/components/FeedItem";
import { PageHeader } from "@/components/PageHeader";
import { searchEntries } from "@/lib/queries";

const searchSchema = z.object({ q: z.string().max(200).optional() });

export default async function SearchPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const parsed = searchSchema.safeParse(await searchParams);
	const q = parsed.success ? (parsed.data.q ?? "") : "";
	const results = q ? await searchEntries(q) : [];

	return (
		<div className="mx-auto max-w-3xl px-6 py-8">
			<PageHeader
				eyebrow="search"
				title="Search Memories"
				blurb="Across every project. Press ⌘K anywhere to jump."
			/>

			<form className="mt-6" action="/search" method="get">
				<input
					name="q"
					defaultValue={q}
					autoFocus
					placeholder="Search claims, gotchas, decisions…"
					className="w-full rounded-[8px] border border-hairline bg-surface/40 px-4 py-3 font-sans text-sm text-ink placeholder:text-muted focus:border-gold focus:outline-none"
				/>
			</form>

			{q && (
				<p className="mt-4 font-mono text-[11px] text-muted">
					{results.length} {results.length === 1 ? "match" : "matches"} for “{q}”
				</p>
			)}

			{q && results.length > 0 && (
				<ul className="mt-3 overflow-hidden rounded-[8px] border border-hairline border-b-0">
					{results.map((entry) => (
						<FeedItem key={entry.id} entry={entry} />
					))}
				</ul>
			)}

			{q && results.length === 0 && (
				<p className="mt-6 font-serif text-[15px] text-muted italic">
					Nothing matched. Memories are sparse on purpose — precision over
					recall.
				</p>
			)}
		</div>
	);
}
