/**
 * Sticky project top bar: mono breadcrumb, an "ingesting…" pulse-dot
 * placeholder (wired to live status later), and a ⌘K hint.
 */
export function ProjectTopBar({ slug }: { slug: string }) {
	return (
		<div className="sticky top-0 z-20 flex items-center justify-between border-b border-hairline bg-bg/85 px-6 py-3 backdrop-blur">
			<nav className="flex items-center gap-1.5 font-mono text-[12px] text-muted">
				<span>projects</span>
				<span className="text-hairline">/</span>
				<span className="text-ink">{slug}</span>
				<span
					className="depot-pulse ml-2 inline-block h-1.5 w-1.5 rounded-full bg-gold"
					title="ingesting…"
					aria-label="ingesting"
				/>
			</nav>
			<span className="font-mono text-[11px] text-muted">
				<kbd className="rounded-[4px] border border-hairline px-1 py-0.5">⌘K</kbd>{" "}
				to jump
			</span>
		</div>
	);
}
