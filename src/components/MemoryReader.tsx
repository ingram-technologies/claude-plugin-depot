"use client";

import { useState } from "react";

import { EvidenceBlock } from "@/components/EvidenceBlock";
import type { EvidenceRow } from "@/lib/queries/types";

/**
 * Composes the claim + body with the Evidence block, owning the hover-
 * illumination link between them: hovering the claim raises (brightens) its
 * supporting evidence rows and dims nothing-else context. Client because it's
 * pure interaction state.
 */
export function MemoryReader({
	claim,
	body,
	evidence,
}: {
	claim: string;
	body: string | null;
	evidence: EvidenceRow[];
}) {
	const [raised, setRaised] = useState(false);

	return (
		<>
			<div
				className="cursor-default"
				onMouseEnter={() => setRaised(true)}
				onMouseLeave={() => setRaised(false)}
			>
				<h1 className="font-serif text-[22px] leading-snug text-ink">
					{claim}
				</h1>
				{body && (
					<div className="prose-serif mt-4 text-[17px] text-ink/90">
						<p>{body}</p>
					</div>
				)}
				<p className="mt-3 font-mono text-[10px] text-muted">
					hover the claim to illuminate its provenance ↓
				</p>
			</div>

			<section className="mt-8">
				<p className="mb-2 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
					evidence · {evidence.length}{" "}
					{evidence.length === 1 ? "record" : "records"}
				</p>
				<EvidenceBlock evidence={evidence} raised={raised} />
			</section>
		</>
	);
}
