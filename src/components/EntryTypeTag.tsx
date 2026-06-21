import type { EntryType } from "@/lib/queries/types";

const LABEL: Record<EntryType, string> = {
	decision: "DECISION",
	gotcha: "GOTCHA",
	principle: "PRINCIPLE",
	state: "STATE",
};

/** Type tag — mono, a machine-fact label. Quiet by default. */
export function EntryTypeTag({ type }: { type: EntryType }) {
	return (
		<span
			className="font-mono text-[10px] tracking-[0.12em] text-muted"
			style={{ fontVariantLigatures: "none" }}
		>
			{LABEL[type]}
		</span>
	);
}
