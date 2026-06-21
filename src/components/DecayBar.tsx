import { daysSince } from "@/lib/queries/freshness";

/**
 * A thin gold→muted decay bar: trust visibly fades with age. Full gold when
 * just seen, fading toward the hairline as it ages out past the horizon.
 */
export function DecayBar({
	lastSeenAt,
	horizonDays = 120,
}: {
	lastSeenAt: Date | null;
	horizonDays?: number;
}) {
	const age = daysSince(lastSeenAt);
	const remaining = age === null ? 0 : Math.max(0, 1 - age / horizonDays);
	const pct = Math.round(remaining * 100);

	return (
		<div
			className="h-px w-full bg-hairline"
			role="img"
			aria-label={`Freshness ${pct}%`}
		>
			<div
				className="h-px"
				style={{
					width: `${pct}%`,
					background:
						"linear-gradient(90deg, var(--color-gold), color-mix(in srgb, var(--color-gold) 30%, transparent))",
				}}
			/>
		</div>
	);
}
