import type { FreshnessBucket } from "@/lib/queries/types";

const COLOR: Record<FreshnessBucket, string> = {
	fresh: "var(--color-fresh)",
	aging: "var(--color-aging)",
	stale: "var(--color-stale)",
};

const LABEL: Record<FreshnessBucket, string> = {
	fresh: "fresh · well-supported",
	aging: "aging",
	stale: "stale or thinly-supported",
};

/**
 * The trust signal. The confidence palette appears ONLY here (and the decay
 * bar) — never decorative.
 */
export function ConfidenceDot({
	bucket,
	size = 8,
}: {
	bucket: FreshnessBucket;
	size?: number;
}) {
	return (
		<span
			title={LABEL[bucket]}
			aria-label={LABEL[bucket]}
			style={{
				display: "inline-block",
				width: size,
				height: size,
				borderRadius: "9999px",
				background: COLOR[bucket],
				flex: "0 0 auto",
			}}
		/>
	);
}
