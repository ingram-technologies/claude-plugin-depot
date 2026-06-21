"use client";

import { useState } from "react";

/**
 * A multi-line, copy-pasteable command/code block — mono, hairline-framed, with
 * a corner copy button. Used by the onboarding plugin-setup step.
 */
export function CodeBlock({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			setTimeout(() => setCopied(false), 1600);
		} catch {
			setCopied(false);
		}
	}

	return (
		<div className="relative overflow-hidden rounded-[8px] border border-hairline bg-surface/40">
			<button
				type="button"
				onClick={copy}
				className="absolute top-2 right-2 rounded-[6px] border border-hairline bg-bg/60 px-2 py-0.5 font-mono text-[10px] transition-colors"
				style={{ color: copied ? "var(--color-fresh)" : "var(--color-gold)" }}
			>
				{copied ? "copied" : "copy"}
			</button>
			<pre className="overflow-x-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-ink/85">
				{code}
			</pre>
		</div>
	);
}
