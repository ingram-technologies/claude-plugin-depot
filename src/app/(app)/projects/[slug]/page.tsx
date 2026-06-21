import { notFound } from "next/navigation";
import { z } from "zod";

import { BriefingSection } from "@/components/BriefingSection";
import { EntryFilterList } from "@/components/EntryFilterList";
import { ProjectTabs } from "@/components/ProjectTabs";
import { ProjectTopBar } from "@/components/ProjectTopBar";
import { PulseBand } from "@/components/PulseBand";
import { RecentlyLearned } from "@/components/RecentlyLearned";
import {
	corpusHealth,
	getProjectBySlug,
	latestBriefing,
	listEntries,
	projectActivity,
	recentlyLearned,
} from "@/lib/queries";

const paramsSchema = z.object({ slug: z.string().min(1).max(160) });

export default async function ProjectPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const parsed = paramsSchema.safeParse(await params);
	if (!parsed.success) {
		notFound();
	}
	const { slug } = parsed.data;

	const project = await getProjectBySlug(slug);
	if (!project) {
		notFound();
	}

	const [briefing, activity, health, entries, recent] = await Promise.all([
		latestBriefing(project.id),
		projectActivity(project.id),
		corpusHealth(project.id),
		listEntries(project.id, { status: "active" }),
		recentlyLearned(project.id),
	]);

	const memoriesPanel = (
		<div className="grid gap-8 lg:grid-cols-[1fr_240px]">
			<EntryFilterList entries={entries} />
			<RecentlyLearned entries={recent} />
		</div>
	);

	return (
		<div>
			<ProjectTopBar slug={project.slug} />
			<div className="mx-auto max-w-5xl px-6 py-8">
				<PulseBand
					project={project}
					briefing={briefing}
					activity={activity}
					health={health}
				/>

				<div className="mt-8">
					<ProjectTabs
						memories={memoriesPanel}
						brief={<BriefingSection briefing={briefing} />}
					/>
				</div>
			</div>
		</div>
	);
}
