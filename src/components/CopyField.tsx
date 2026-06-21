"use client";

import { useState } from "react";

/**
 * A mono one-line value with a copy-to-clipboard button — the canonical way
 * Depot surfaces machine facts (tokens, commands, ids) the user must lift out.
 * `secret` masks the value behind dots until revealed; nothing is persisted
 * client-side beyond the in-memory copy.
 */
export function CopyField({
	value,
	label,
	secret = false,
}: {
	value: string;
	label?: string;
	secret?: boolean;
}) {
	const [copied, setCopied] = useState(false);
	const [revealed, setRevealed] = useState(!secret);

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			setTimeout(() => setCopied(false), 1600);
		} catch {
			setCopied(false);
		}
	}

	const shown = revealed ? value : "•".repeat(Math.min(value.length, 44));

	return (
		<div className="flex flex-col gap-1">
			{label && (
				<span className="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
					{label}
				</span>
			)}
			<div className="flex items-stretch overflow-hidden rounded-[6px] border border-hairline bg-surface/40">
				<code className="min-w-0 flex-1 overflow-x-auto px-3 py-2 font-mono text-[12px] whitespace-nowrap text-ink">
					{shown}
				</code>
				{secret && (
					<button
						type="button"
						onClick={() => setRevealed((r) => !r)}
						className="border-l border-hairline px-3 font-mono text-[11px] text-muted transition-colors hover:text-ink"
					>
						{revealed ? "hide" : "show"}
					</button>
				)}
				<button
					type="button"
					onClick={copy}
					className="border-l border-hairline px-3 font-mono text-[11px] transition-colors"
					style={{ color: copied ? "var(--color-fresh)" : "var(--color-gold)" }}
				>
					{copied ? "copied" : "copy"}
				</button>
			</div>
		</div>
	);
}
