/** Standard page header: mono eyebrow, sans title, sans blurb. */
export function PageHeader({
	eyebrow,
	title,
	blurb,
}: {
	eyebrow: string;
	title: string;
	blurb?: string;
}) {
	return (
		<header>
			<p className="font-mono text-[11px] tracking-[0.14em] text-gold/80 uppercase">
				{eyebrow}
			</p>
			<h1 className="mt-1 font-sans text-xl font-semibold tracking-tight text-ink">
				{title}
			</h1>
			{blurb && (
				<p className="mt-1.5 max-w-xl font-sans text-sm text-muted">{blurb}</p>
			)}
		</header>
	);
}
