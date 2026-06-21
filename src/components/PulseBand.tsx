import { Caret } from "@/components/Caret";
import { ConfidenceDot } from "@/components/ConfidenceDot";
import { Sparkline } from "@/components/Sparkline";
import { shortAgo } from "@/lib/queries/freshness";
import type {
	ActivityDay,
	BriefingView,
	CorpusHealth,
	ProjectSummary,
} from "@/lib/queries/types";

/**
 * The hero pulse band: the project's "state of mind" sentence (large serif,
 * italic, with the heartbeat caret) and a mono vitals stack with a 30-day
 * activity sparkline and three corpus-health dots.
 */
export function PulseBand({
	project,
	briefing,
	activity,
	health,
}: {
	project: ProjectSummary;
	briefing: BriefingView | null;
	activity: ActivityDay[];
	health: CorpusHealth;
}) {
	const stateOfMind =
		briefing?.stateOfMind ??
		"No state of mind distilled yet — analysis hasn't run for this project.";

	return (
		<section className="grid gap-8 border-b border-hairline pb-8 md:grid-cols-[1fr_auto]">
			<div className="max-w-xl">
				<p className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
					state of mind
				</p>
				<p className="mt-3 font-serif text-[24px] leading-snug text-ink italic">
					{stateOfMind}
					<Caret />
				</p>
			</div>

			<div className="flex min-w-[200px] flex-col gap-3">
				<Vital
					label="last learned"
					value={shortAgo(project.lastLearnedAt)}
				/>
				<Vital
					label="memories"
					value={String(project.entryCount)}
				/>
				<Vital
					label="sessions"
					value={String(project.sessionCount)}
				/>
				<div>
					<p className="mb-1 font-mono text-[10px] text-muted uppercase tracking-wider">
						activity · 30d
					</p>
					<Sparkline days={activity} />
				</div>
				<div className="flex items-center gap-3 pt-1">
					<HealthDot bucket="fresh" n={health.fresh} />
					<HealthDot bucket="aging" n={health.aging} />
					<HealthDot bucket="stale" n={health.stale} />
				</div>
			</div>
		</section>
	);
}

function Vital({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-baseline justify-between gap-6 border-b border-hairline pb-1">
			<span className="font-mono text-[10px] text-muted uppercase tracking-wider">
				{label}
			</span>
			<span className="font-mono text-[13px] text-ink tabular-nums">
				{value}
			</span>
		</div>
	);
}

function HealthDot({
	bucket,
	n,
}: {
	bucket: "fresh" | "aging" | "stale";
	n: number;
}) {
	return (
		<span className="flex items-center gap-1.5">
			<ConfidenceDot bucket={bucket} size={7} />
			<span className="font-mono text-[11px] text-muted tabular-nums">{n}</span>
		</span>
	);
}
