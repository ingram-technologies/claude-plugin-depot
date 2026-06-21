import { PageHeader } from "@/components/PageHeader";
import { TeamManager } from "@/components/team/TeamManager";
import { loadTeam } from "@/app/(app)/settings/team/actions";

export default async function TeamPage() {
	const team = await loadTeam();

	if (!team) {
		return (
			<div className="mx-auto max-w-3xl px-6 py-8">
				<PageHeader eyebrow="settings · team" title="Team" blurb="No organization yet." />
				<p className="mt-6 font-sans text-sm text-muted">
					Create or join an organization first.{" "}
					<a href="/onboarding" className="text-gold underline">
						Onboarding →
					</a>
				</p>
			</div>
		);
	}

	const canManage = team.viewerRole === "owner" || team.viewerRole === "admin";

	return (
		<div className="mx-auto max-w-3xl px-6 py-8">
			<PageHeader
				eyebrow="settings · team"
				title={team.orgName}
				blurb={
					canManage
						? "Invite teammates, set roles, and manage who can contribute to this org's memory."
						: "Your organization's members. Ask an owner or admin to make changes."
				}
			/>

			<div className="mt-2 font-mono text-[11px] text-muted">
				org {team.orgId} · you are {team.viewerRole}
			</div>

			<div className="mt-8">
				<TeamManager
					members={team.members}
					invitations={team.invitations}
					canManage={canManage}
					viewerUserId={team.viewerUserId}
				/>
			</div>
		</div>
	);
}
