"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { signOut } from "@/lib/auth-client";

type NavItem = {
	href: string;
	label: string;
	hint: string;
	match: (p: string) => boolean;
};

const NAV: NavItem[] = [
	{
		href: "/",
		label: "Feed",
		hint: "recent distillations",
		match: (p) => p === "/",
	},
	{
		href: "/projects",
		label: "Projects",
		hint: "the spine",
		match: (p) => p === "/projects" || p.startsWith("/projects/"),
	},
	{
		href: "/search",
		label: "Search",
		hint: "⌘K",
		match: (p) => p === "/search",
	},
	{
		href: "/tokens",
		label: "API",
		hint: "read tokens",
		match: (p) => p === "/tokens",
	},
];

export function Sidebar({ viewerName }: { viewerName: string }) {
	const pathname = usePathname();
	const [collapsed, setCollapsed] = useState(false);

	return (
		<aside
			className="sticky top-0 flex h-dvh shrink-0 flex-col border-r border-hairline bg-surface/40 transition-[width] duration-200"
			style={{ width: collapsed ? 56 : 220 }}
		>
			<div className="flex items-center gap-2 px-4 py-4">
				<span className="font-mono text-gold text-sm">▍</span>
				{!collapsed && (
					<span className="font-sans font-semibold tracking-tight text-ink">
						depot
					</span>
				)}
			</div>

			<nav className="mt-2 flex flex-col gap-0.5 px-2">
				{NAV.map((item) => {
					const active = item.match(pathname);
					return (
						<Link
							key={item.href}
							href={item.href}
							className="group relative flex flex-col rounded-[6px] px-2.5 py-1.5 transition-colors hover:bg-surface"
							style={
								active
									? { boxShadow: "inset 2px 0 0 var(--color-gold)" }
									: undefined
							}
						>
							<span
								className="font-sans text-[13px]"
								style={{
									color: active ? "var(--color-gold)" : "var(--color-ink)",
								}}
							>
								{item.label}
							</span>
							{!collapsed && (
								<span className="font-mono text-[10px] text-muted">
									{item.hint}
								</span>
							)}
						</Link>
					);
				})}
			</nav>

			<div className="mt-auto flex flex-col gap-1 border-t border-hairline px-2.5 py-3">
				{!collapsed && (
					<span className="truncate font-mono text-[10px] text-muted">
						{viewerName}
					</span>
				)}
				<div className="flex items-center justify-between">
					<button
						type="button"
						onClick={() => signOut()}
						className="font-sans text-[11px] text-muted transition-colors hover:text-stale"
					>
						{collapsed ? "⏻" : "sign out"}
					</button>
					<button
						type="button"
						aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
						onClick={() => setCollapsed((c) => !c)}
						className="font-mono text-[12px] text-muted transition-colors hover:text-ink"
					>
						{collapsed ? "»" : "«"}
					</button>
				</div>
			</div>
		</aside>
	);
}
