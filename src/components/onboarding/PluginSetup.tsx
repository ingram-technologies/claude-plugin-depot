import { CodeBlock } from "@/components/CodeBlock";

/**
 * Plugin-setup instructions. Pure presentational (server-renderable): the
 * install commands, the env export (with the token if one was just minted), and
 * the sync command. `token` is the freshly-minted raw value or a placeholder.
 */
export function PluginSetup({ token, depotUrl }: { token: string | null; depotUrl: string }) {
	const tokenValue = token ?? "dpt_…";

	const install = `/plugin marketplace add ingram-technologies/depot.ingram.tech
/plugin install depot@depot`;

	const env = `export DEPOT_TOKEN="${tokenValue}"
export DEPOT_URL="${depotUrl}"`;

	return (
		<div className="flex flex-col gap-6">
			<Step
				n="a"
				title="Install the Depot plugin"
				blurb="In Claude Code, add the marketplace and install the plugin. It auto-syncs after every session via a SessionEnd hook."
			>
				<CodeBlock code={install} />
			</Step>

			<Step
				n="b"
				title="Set your environment"
				blurb="Put these in your shell profile (~/.zshrc or ~/.bashrc) so both your shell and Claude Code's hooks inherit them."
			>
				<CodeBlock code={env} />
				{!token && (
					<p className="mt-1 font-mono text-[11px] text-muted">
						Replace dpt_… with the token from the step above.
					</p>
				)}
			</Step>

			<Step
				n="c"
				title="Sync"
				blurb="Run an on-demand sync from inside Claude Code, or use the standalone CLI. From then on your sessions sync automatically."
			>
				<CodeBlock code={`/depot:depot-sync`} />
				<p className="mt-1 font-mono text-[11px] text-muted">
					or, from a shell: bun bin/depot-upload.ts --once
				</p>
			</Step>

			<p className="font-sans text-[13px] text-muted">
				Your transcripts are distilled, per project, into this org's cited Memories. Nothing but the
				transcript records and a machine fingerprint is sent — never tokens or secrets.
			</p>
		</div>
	);
}

function Step({
	n,
	title,
	blurb,
	children,
}: {
	n: string;
	title: string;
	blurb: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-baseline gap-2">
				<span className="font-mono text-[12px] text-gold">{n}.</span>
				<span className="font-sans text-[14px] font-medium text-ink">{title}</span>
			</div>
			<p className="font-sans text-[12px] text-muted">{blurb}</p>
			{children}
		</div>
	);
}
