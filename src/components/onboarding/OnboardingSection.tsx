/** A numbered onboarding section: gold step chip, sans title, framed body. */
export function OnboardingSection({
	step,
	title,
	children,
}: {
	step: string;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="flex flex-col gap-4">
			<div className="flex items-center gap-3">
				<span className="flex size-6 items-center justify-center rounded-full border border-gold/50 font-mono text-[11px] text-gold">
					{step}
				</span>
				<h2 className="font-sans text-[15px] font-semibold tracking-tight text-ink">
					{title}
				</h2>
			</div>
			<div className="pl-9">{children}</div>
		</section>
	);
}
