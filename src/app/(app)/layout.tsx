import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CommandPalette } from "@/components/CommandPalette";
import { Sidebar } from "@/components/Sidebar";
import { requireViewer } from "@/lib/auth-helpers";
import { listProjects } from "@/lib/queries";

export default async function AppLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const viewer = await requireViewer();

	// A signed-in user with no organization is sent to onboarding (create/join
	// an org, mint a personal token, set up the plugin). Guard the loop: the
	// onboarding route itself lives under this layout.
	const pathname = (await headers()).get("x-pathname") ?? "";
	if (!viewer.activeOrg && !pathname.startsWith("/onboarding")) {
		redirect("/onboarding");
	}

	// Org-scope the sidebar + ⌘K palette to the viewer's active org.
	const projects = viewer.activeOrg
		? await listProjects({ organizationId: viewer.activeOrg.id })
		: [];

	return (
		<div className="flex min-h-dvh">
			<Sidebar viewerName={viewer.user.name} />
			<main className="min-w-0 flex-1">{children}</main>
			<CommandPalette projects={projects} />
		</div>
	);
}
