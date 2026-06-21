import { PageHeader } from "@/components/PageHeader";

const HOST =
	process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? "https://depot.ingram.tech";

const ENDPOINTS = [
	{ method: "GET", path: "/api/v1/projects", note: "list projects" },
	{
		method: "GET",
		path: "/api/v1/projects/{slug}",
		note: "a project + its Memories",
	},
	{
		method: "GET",
		path: "/api/v1/projects/{slug}/briefing",
		note: "the cited brief",
	},
];

export default function ApiTokensPage() {
	return (
		<div className="mx-auto max-w-3xl px-6 py-8">
			<PageHeader
				eyebrow="api"
				title="Read API"
				blurb="Agents read a project's Memory over HTTP. Bearer-token gated; the same provenance you see in the UI ships in the JSON."
			/>

			<section className="mt-8">
				<p className="mb-2 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
					endpoints
				</p>
				<ul className="overflow-hidden rounded-[8px] border border-hairline">
					{ENDPOINTS.map((e) => (
						<li
							key={e.path}
							className="flex items-center gap-3 border-b border-hairline px-4 py-2.5 last:border-b-0"
						>
							<span className="w-10 shrink-0 font-mono text-[11px] text-fresh">
								{e.method}
							</span>
							<code className="flex-1 font-mono text-[12px] text-ink">
								{e.path}
							</code>
							<span className="font-sans text-[11px] text-muted">{e.note}</span>
						</li>
					))}
				</ul>
			</section>

			<section className="mt-8">
				<p className="mb-2 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
					example
				</p>
				<pre className="overflow-x-auto rounded-[8px] border border-hairline bg-surface/40 px-4 py-3 font-mono text-[11px] leading-relaxed text-ink/85">
					{`curl -H "Authorization: Bearer dpt_…" \\
  ${HOST}/api/v1/projects/depot/briefing`}
				</pre>
			</section>

			<section className="mt-8 rounded-[8px] border border-dashed border-hairline px-5 py-6">
				<p className="font-mono text-[11px] tracking-[0.14em] text-gold/80 uppercase">
					tokens
				</p>
				<p className="mt-2 font-sans text-[13px] text-muted">
					Read tokens reuse the ingest-token machinery (sha256-hashed, shown
					once, revocable). A self-serve issue/revoke UI is the next step — for
					now tokens are minted via{" "}
					<code className="font-mono text-gold">issueIngestToken()</code>.
				</p>
			</section>
		</div>
	);
}
