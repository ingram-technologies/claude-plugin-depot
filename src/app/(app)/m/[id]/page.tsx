import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ConfidenceDot } from "@/components/ConfidenceDot";
import { CurationButtons } from "@/components/CurationButtons";
import { DecayBar } from "@/components/DecayBar";
import { EntryTypeTag } from "@/components/EntryTypeTag";
import { MemoryReader } from "@/components/MemoryReader";
import {
	freshnessBucket,
	getEntry,
	isStale,
	shortAgo,
	type RelatedEntry,
} from "@/lib/queries";

const paramsSchema = z.object({ id: z.string().min(1).max(64) });

const STATUS_NOTE: Record<string, string> = {
	superseded: "This Memory has been superseded by a newer one.",
	contested: "A human disputed this Memory — treat with care.",
	retired: "This Memory was marked outdated and retired.",
};

export default async function MemoryPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const parsed = paramsSchema.safeParse(await params);
	if (!parsed.success) {
		notFound();
	}

	const entry = await getEntry(parsed.data.id);
	if (!entry) {
		notFound();
	}

	const bucket = freshnessBucket(entry.lastSeenAt, entry.confidence);
	const stale = isStale(entry.lastSeenAt, entry.confidence);
	const statusNote = STATUS_NOTE[entry.status];

	return (
		<article className="mx-auto measure px-6 py-10">
			{/* header — mono machine facts */}
			<div className="mb-1 flex items-center gap-2 font-mono text-[12px] text-muted">
				<EntryTypeTag type={entry.entryType} />
				<span>·</span>
				<Link
					href={`/projects/${entry.projectSlug}`}
					className="text-muted hover:text-gold"
				>
					{entry.projectSlug}
				</Link>
			</div>

			<div className="mb-2 flex items-center gap-2">
				<ConfidenceDot bucket={bucket} />
				<span className="font-mono text-[11px] text-muted tabular-nums">
					confidence {entry.confidence.toFixed(2)} · last seen{" "}
					{shortAgo(entry.lastSeenAt)} · {entry.sessionCount}{" "}
					{entry.sessionCount === 1 ? "session" : "sessions"}
				</span>
			</div>

			<DecayBar lastSeenAt={entry.lastSeenAt} />

			{(stale || statusNote) && (
				<div
					className="mt-4 rounded-[6px] border px-3 py-2 font-sans text-[12px]"
					style={{
						borderColor: "var(--color-stale)",
						color: "var(--color-stale)",
						background:
							"color-mix(in srgb, var(--color-stale) 8%, transparent)",
					}}
				>
					{statusNote ?? "May be outdated — last seen a while ago."}
				</div>
			)}

			{entry.scope && (
				<p className="mt-4 font-mono text-[11px] text-muted">
					scope: <span className="text-ink/80">{entry.scope}</span>
				</p>
			)}

			<div className="mt-6">
				<MemoryReader
					claim={entry.claim}
					body={entry.body}
					evidence={entry.evidence}
				/>
			</div>

			{/* curation */}
			<section className="mt-10 border-t border-hairline pt-6">
				<p className="mb-3 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
					your verdict
				</p>
				<CurationButtons entryId={entry.id} />
			</section>

			{/* supersession + related footer */}
			<footer className="mt-10 flex flex-col gap-6 border-t border-hairline pt-6">
				{entry.supersededBy && (
					<RelatedGroup
						label="superseded by"
						items={[entry.supersededBy]}
						tone="stale"
					/>
				)}
				{entry.supersedes.length > 0 && (
					<RelatedGroup label="supersedes" items={entry.supersedes} />
				)}
				{entry.related.length > 0 && (
					<RelatedGroup label="related" items={entry.related} />
				)}
			</footer>
		</article>
	);
}

function RelatedGroup({
	label,
	items,
	tone,
}: {
	label: string;
	items: RelatedEntry[];
	tone?: "stale";
}) {
	return (
		<div>
			<p
				className="mb-2 font-mono text-[10px] tracking-[0.14em] uppercase"
				style={{
					color:
						tone === "stale" ? "var(--color-stale)" : "var(--color-muted)",
				}}
			>
				{label}
			</p>
			<ul className="flex flex-col gap-1.5">
				{items.map((it) => (
					<li key={it.id}>
						<Link
							href={`/m/${it.id}`}
							className="group flex items-baseline gap-2"
						>
							<EntryTypeTag type={it.entryType} />
							<span className="font-serif text-[14px] text-ink/90 group-hover:text-gold">
								{it.claim}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}
