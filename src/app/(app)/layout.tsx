import { redirect } from "next/navigation";

import { CommandPalette } from "@/components/CommandPalette";
import { Sidebar } from "@/components/Sidebar";
import { listProjects } from "@/lib/queries";
import { getViewer } from "@/lib/queries/session";

export default async function AppLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const viewer = await getViewer();
	if (!viewer) {
		redirect("/sign-in");
	}

	// Small set — fine to load once for the sidebar + ⌘K palette.
	const projects = await listProjects();

	return (
		<div className="flex min-h-dvh">
			<Sidebar viewerName={viewer.name} />
			<main className="min-w-0 flex-1">{children}</main>
			<CommandPalette projects={projects} />
		</div>
	);
}
