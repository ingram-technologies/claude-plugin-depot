# pulumi — Depot's Ingram Cloud analyzer agents

This is the **per-app agent definition** for Depot's three Ingram Cloud
analyzer agents:

| Resource (slug)       | Spec                  | Role                              |
| --------------------- | --------------------- | -------------------------------- |
| `depot-extractor`     | `EXTRACTOR_AGENT`     | extract claims from one session  |
| `depot-canonicalizer` | `CANONICALIZER_AGENT` | place a claim vs. existing entries|
| `depot-briefer`       | `BRIEFER_AGENT`       | write a per-project briefing      |

The specs (slug, name, instructions, model, tools, memory, variables) are the
app's source of truth in [`../src/lib/agent/specs.ts`](../src/lib/agent/specs.ts).
This program imports them and declares each as an `IcAgent`
(`@ingram-tech/pulumi-ingram-cloud`): create-or-adopt by `slug`, publish a new
immutable version **only when the content changes**, then roll it out. Editing a
prompt or model is editing `specs.ts`; shipping it is `pulumi up`.

**The prompt never leaves the app repo.** Tenant-level wiring — minting the
project's `tenant:*` token, pushing IC-derived values into Vercel env, any MCP /
integration config — lives in `~/src/infra`, not here.

This is a standalone sub-project: its own `node_modules`, `tsconfig.json`, and
Pulumi stack state. It is gitignored from the app's normal toolchain and is not
part of `bun run check`.

## Deploy

```bash
cd pulumi
bun install

# Select (or create) the stack.
pulumi stack select prod   # or: pulumi stack init prod

# Set the IC tenant-admin token as a stack SECRET (a tha_live_… / tenant:* token).
# Resolution: ingram-cloud:token (secret) → INGRAM_CLOUD_TOKEN → CLOUD_API_KEY.
pulumi config set --secret ingram-cloud:token tha_live_…

# Optional: override the API base URL (default https://api.cloud.ingram.tech).
# pulumi config set ingram-cloud:baseUrl https://api.cloud.ingram.tech

pulumi preview     # review the three IcAgent create-or-adopts
pulumi up
```

The first `pulumi up` **adopts** any agent that already exists (matched by
`slug`) rather than recreating it, mirroring the old `ensure-agent.ts`
idempotency. A later prompt/model edit publishes a new version and rolls it out.

## Read the agent ids back into the app's env

Each agent id is a stack output. Wire them into the app as
`DEPOT_EXTRACTOR_AGENT_ID`, `DEPOT_CANONICALIZER_AGENT_ID`,
`DEPOT_BRIEFER_AGENT_ID`:

```bash
pulumi stack output extractorAgentId        # agt_…
pulumi stack output canonicalizerAgentId    # agt_…
pulumi stack output brieferAgentId          # agt_…

# Or all three at once:
pulumi stack output agentIds --json
# {"extractor":"agt_…","canonicalizer":"agt_…","briefer":"agt_…"}
```

Drop those into the app's env (`.env.local` for dev, the app's Vercel env for
prod). In production, prefer letting the infra stack read these outputs via
`pulumi.StackReference` and push them into Vercel env, rather than copy-pasting.

## Notes

- Token and every credential input are marked `additionalSecretOutputs`, so they
  stay encrypted in Pulumi state.
- `read` treats a server-side 404 as "gone", so if an agent is deleted
  out-of-band, `pulumi refresh && pulumi up` recreates it.
