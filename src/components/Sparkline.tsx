import type { ActivityDay } from "@/lib/queries/types";

/**
 * 30-day session-activity sparkline — inline SVG, gold on hairline. Fills gaps
 * for days with no sessions so the timeline is honest about quiet stretches.
 */
export function Sparkline({
	days,
	window = 30,
	width = 160,
	height = 34,
}: {
	days: ActivityDay[];
	window?: number;
	width?: number;
	height?: number;
}) {
	const counts = densify(days, window);
	const max = Math.max(1, ...counts);
	const n = counts.length;
	const barW = width / n;
	const gap = barW > 3 ? 1 : 0;

	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			role="img"
			aria-label={`Session activity over the last ${window} days`}
			style={{ display: "block" }}
		>
			{/* baseline hairline */}
			<line
				x1={0}
				y1={height - 0.5}
				x2={width}
				y2={height - 0.5}
				stroke="var(--color-hairline)"
				strokeWidth={1}
			/>
			{counts.map((c, i) => {
				const h = c === 0 ? 0 : Math.max(2, (c / max) * (height - 4));
				const x = i * barW;
				return (
					<rect
						key={i}
						x={x + gap / 2}
						y={height - h - 0.5}
						width={Math.max(0.75, barW - gap)}
						height={h}
						fill={c === 0 ? "var(--color-hairline)" : "var(--color-gold)"}
						opacity={c === 0 ? 0.5 : 0.85}
						rx={0.5}
					/>
				);
			})}
		</svg>
	);
}

function densify(days: ActivityDay[], window: number): number[] {
	const byDay = new Map(days.map((d) => [d.day, d.count]));
	const out: number[] = [];
	const today = new Date();
	for (let i = window - 1; i >= 0; i--) {
		const d = new Date(today);
		d.setDate(today.getDate() - i);
		const key = d.toISOString().slice(0, 10);
		out.push(byDay.get(key) ?? 0);
	}
	return out;
}
