import Link from "next/link";

/** A project's identity, always mono (it's a machine fact: the slug). */
export function ProjectChip({ slug }: { slug: string }) {
	return (
		<Link
			href={`/projects/${slug}`}
			className="font-mono text-[11px] text-muted hover:text-gold rounded-[4px] border border-hairline px-1.5 py-0.5 transition-colors"
		>
			{slug}
		</Link>
	);
}
