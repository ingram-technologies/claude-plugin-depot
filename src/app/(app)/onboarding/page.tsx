import { z } from "zod";

import { PageHeader } from "@/components/PageHeader";
import { AcceptInvite } from "@/components/onboarding/AcceptInvite";
import { CreateOrg } from "@/components/onboarding/CreateOrg";
import { OnboardingSection } from "@/components/onboarding/OnboardingSection";
import { TokenAndSetup } from "@/components/onboarding/TokenAndSetup";
import { requireViewer } from "@/lib/auth-helpers";

const DEPOT_URL =
	process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? "https://depot.ingram.tech";

const searchSchema = z.object({
	invitation: z.string().min(1).max(128).optional(),
	step: z.enum(["org", "token"]).optional(),
});

export default async function OnboardingPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const viewer = await requireViewer();
	const parsed = searchSchema.safeParse(await searchParams);
	const invitation = parsed.success ? parsed.data.invitation : undefined;
	const forcedStep = parsed.success ? parsed.data.step : undefined;

	const hasOrg = Boolean(viewer.activeOrg);

	// An explicit ?invitation=… always shows the accept step first (even for a
	// user who already has an org — they may be joining a second one).
	const showInvite = Boolean(invitation);
	// Org-create: no org yet (and not mid-invite), or asked for via ?step=org.
	const showOrgStep =
		!showInvite && (forcedStep === "org" || (!hasOrg && !forcedStep));
	// Token + plugin: only once a tenant exists to bind the token to.
	const showTokenSteps = !showInvite && !showOrgStep && hasOrg;

	return (
		<div className="mx-auto max-w-2xl px-6 py-10">
			<PageHeader
				eyebrow="onboarding"
				title={
					hasOrg
						? `Welcome, ${viewer.person.displayName}`
						: "Get set up on Depot"
				}
				blurb="Connect Claude Code so your sessions become your team's cited, per-project Memories."
			/>

			<div className="mt-10 flex flex-col gap-10">
				{showInvite && invitation && (
					<OnboardingSection step="1" title="You've been invited">
						<AcceptInvite invitationId={invitation} />
					</OnboardingSection>
				)}

				{showOrgStep && (
					<OnboardingSection step="1" title="Create your organization">
						<CreateOrg />
					</OnboardingSection>
				)}

				{showTokenSteps && <TokenAndSetup depotUrl={DEPOT_URL} />}

				{!showInvite && !showOrgStep && !showTokenSteps && (
					<p className="font-sans text-sm text-muted">
						Nothing to do here right now.
					</p>
				)}
			</div>
		</div>
	);
}
