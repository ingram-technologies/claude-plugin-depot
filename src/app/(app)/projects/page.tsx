import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { isLiveEdge, listProjects, shortAgo } from "@/lib/queries";

export default async function ProjectsPage() {
	const projects = await listProjects();

	return (
		<div className="mx-auto max-w-3xl px-6 py-8">
			<PageHeader
				eyebrow="projects"
				title="The spine"
				blurb="Every codebase Depot is keeping memory for, by most recently learned."
			/>

			{projects.length === 0 ? (
				<p className="mt-10 font-sans text-sm text-muted">
					No projects yet. Ingest some sessions to get started.
				</p>
			) : (
				<ul className="mt-6 overflow-hidden rounded-[8px] border border-hairline border-b-0">
					{projects.map((p) => {
						const live = isLiveEdge(p.lastLearnedAt);
						return (
							<li
								key={p.id}
								className={`border-b border-hairline ${live ? "live-edge" : ""}`}
							>
								<Link
									href={`/projects/${p.slug}`}
									className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface/60"
								>
									<div className="min-w-0 flex-1">
										<div className="flex items-baseline gap-2">
											<span className="font-sans text-[15px] font-medium text-ink group-hover:text-gold">
												{p.displayName}
											</span>
											<span className="truncate font-mono text-[11px] text-muted">
												{p.slug}
											</span>
										</div>
										{p.description && (
											<p className="mt-0.5 truncate font-sans text-[12px] text-muted">
												{p.description}
											</p>
										)}
									</div>
									<div className="shrink-0 text-right">
										<p className="font-mono text-[11px] text-ink tabular-nums">
											{p.entryCount}{" "}
											{p.entryCount === 1 ? "memory" : "memories"}
										</p>
										<p className="font-mono text-[10px] text-muted">
											learned {shortAgo(p.lastLearnedAt)}
										</p>
									</div>
								</Link>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
