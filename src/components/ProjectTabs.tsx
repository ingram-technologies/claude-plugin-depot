"use client";

import { useState } from "react";

type Tab = "memories" | "brief";

/**
 * Memories ↔ Brief switcher on the project page. Both panels are server-
 * rendered and passed as children; this just toggles visibility so neither
 * re-fetches on switch.
 */
export function ProjectTabs({
	memories,
	brief,
}: {
	memories: React.ReactNode;
	brief: React.ReactNode;
}) {
	const [tab, setTab] = useState<Tab>("memories");

	return (
		<div>
			<div className="mb-4 flex gap-1 border-b border-hairline">
				<TabButton
					active={tab === "memories"}
					onClick={() => setTab("memories")}
				>
					Memories
				</TabButton>
				<TabButton active={tab === "brief"} onClick={() => setTab("brief")}>
					The brief
				</TabButton>
			</div>
			<div hidden={tab !== "memories"}>{memories}</div>
			<div hidden={tab !== "brief"}>{brief}</div>
		</div>
	);
}

function TabButton({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="-mb-px border-b-2 px-3 py-2 font-sans text-[13px] transition-colors"
			style={{
				borderColor: active ? "var(--color-gold)" : "transparent",
				color: active ? "var(--color-gold)" : "var(--color-muted)",
			}}
		>
			{children}
		</button>
	);
}
