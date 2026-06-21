"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ProjectSummary } from "@/lib/queries/types";

type Cmd = {
	id: string;
	kind: "project" | "nav";
	label: string;
	hint: string;
	href: string;
};

/**
 * ⌘K palette. Projects are passed from the server (small set); nav actions are
 * static. Entry-level full-text search lives on the /search page. Client-only
 * because it owns keyboard + focus state.
 */
export function CommandPalette({ projects }: { projects: ProjectSummary[] }) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [q, setQ] = useState("");
	const [active, setActive] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	const commands = useMemo<Cmd[]>(() => {
		const projectCmds: Cmd[] = projects.map((p) => ({
			id: p.id,
			kind: "project",
			label: p.displayName,
			hint: p.slug,
			href: `/projects/${p.slug}`,
		}));
		const navCmds: Cmd[] = [
			{ id: "feed", kind: "nav", label: "Feed", hint: "go", href: "/" },
			{
				id: "projects",
				kind: "nav",
				label: "All projects",
				hint: "go",
				href: "/projects",
			},
			{
				id: "search",
				kind: "nav",
				label: "Full-text search",
				hint: "go",
				href: q ? `/search?q=${encodeURIComponent(q)}` : "/search",
			},
		];
		return [...projectCmds, ...navCmds];
	}, [projects, q]);

	const filtered = useMemo(() => {
		const needle = q.trim().toLowerCase();
		if (!needle) {
			return commands;
		}
		return commands.filter(
			(c) =>
				c.label.toLowerCase().includes(needle) ||
				c.hint.toLowerCase().includes(needle),
		);
	}, [commands, q]);

	const close = useCallback(() => {
		setOpen(false);
		setQ("");
		setActive(0);
	}, []);

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setOpen((o) => !o);
			} else if (e.key === "Escape") {
				close();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [close]);

	useEffect(() => {
		if (open) {
			inputRef.current?.focus();
		}
	}, [open]);

	useEffect(() => {
		setActive(0);
	}, [q]);

	if (!open) {
		return null;
	}

	function go(cmd: Cmd | undefined) {
		if (!cmd) {
			return;
		}
		close();
		router.push(cmd.href);
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[18vh]"
			onClick={close}
		>
			<div
				className="w-full max-w-xl overflow-hidden rounded-[8px] border border-hairline bg-surface"
				onClick={(e) => e.stopPropagation()}
			>
				<input
					ref={inputRef}
					value={q}
					onChange={(e) => setQ(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "ArrowDown") {
							e.preventDefault();
							setActive((a) => Math.min(a + 1, filtered.length - 1));
						} else if (e.key === "ArrowUp") {
							e.preventDefault();
							setActive((a) => Math.max(a - 1, 0));
						} else if (e.key === "Enter") {
							e.preventDefault();
							go(filtered[active]);
						}
					}}
					placeholder="Jump to a project, or search…"
					className="w-full border-b border-hairline bg-transparent px-4 py-3 font-sans text-sm text-ink placeholder:text-muted focus:outline-none"
				/>
				<ul className="max-h-80 overflow-y-auto py-1">
					{filtered.length === 0 && (
						<li className="px-4 py-3 font-sans text-sm text-muted">
							No matches.
						</li>
					)}
					{filtered.map((cmd, i) => (
						<li key={`${cmd.kind}-${cmd.id}`}>
							<button
								type="button"
								onMouseEnter={() => setActive(i)}
								onClick={() => go(cmd)}
								className="flex w-full items-center justify-between px-4 py-2 text-left"
								style={{
									background:
										i === active
											? "var(--color-bg)"
											: "transparent",
								}}
							>
								<span className="font-sans text-[13px] text-ink">
									{cmd.label}
								</span>
								<span className="font-mono text-[10px] text-muted">
									{cmd.hint}
								</span>
							</button>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
