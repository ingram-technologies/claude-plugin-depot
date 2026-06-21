/**
 * Depot's Ingram Cloud analyzer agents, as Pulumi resources. The specs +
 * prompts live in the app repo (src/lib/agent/specs.ts); this program declares
 * each as an `IcAgent` against @ingram-tech/pulumi-ingram-cloud (create-or-adopt
 * by `slug`, publish a new version only when the content changes, then roll it
 * out). Editing extraction quality is editing specs.ts; shipping it is `pulumi up`.
 *
 * The agent ids are exported so the app's `DEPOT_*_AGENT_ID` env vars can be
 * populated from `pulumi stack output`. Tenant-level wiring (project token,
 * Vercel env, any MCP/integrations) lives in the infra repo (~/src/infra).
 *
 * Token/baseUrl come from `ingram-cloud:token` (stack secret) or
 * INGRAM_CLOUD_TOKEN — see connectionFromConfig().
 */
import * as ic from "@ingram-tech/pulumi-ingram-cloud";
import {
	BRIEFER_AGENT,
	CANONICALIZER_AGENT,
	EXTRACTOR_AGENT,
} from "../src/lib/agent/specs";

const conn = ic.connectionFromConfig();

const extractor = new ic.IcAgent(EXTRACTOR_AGENT.slug, {
	...conn,
	name: EXTRACTOR_AGENT.name,
	instructions: EXTRACTOR_AGENT.instructions,
	model: EXTRACTOR_AGENT.model,
	enabledHostedTools: EXTRACTOR_AGENT.enabledHostedTools,
	autoMemory: EXTRACTOR_AGENT.autoMemory,
	variables: EXTRACTOR_AGENT.variables,
});

const canonicalizer = new ic.IcAgent(CANONICALIZER_AGENT.slug, {
	...conn,
	name: CANONICALIZER_AGENT.name,
	instructions: CANONICALIZER_AGENT.instructions,
	model: CANONICALIZER_AGENT.model,
	enabledHostedTools: CANONICALIZER_AGENT.enabledHostedTools,
	autoMemory: CANONICALIZER_AGENT.autoMemory,
	variables: CANONICALIZER_AGENT.variables,
});

const briefer = new ic.IcAgent(BRIEFER_AGENT.slug, {
	...conn,
	name: BRIEFER_AGENT.name,
	instructions: BRIEFER_AGENT.instructions,
	model: BRIEFER_AGENT.model,
	enabledHostedTools: BRIEFER_AGENT.enabledHostedTools,
	autoMemory: BRIEFER_AGENT.autoMemory,
	variables: BRIEFER_AGENT.variables,
});

export const extractorAgentId = extractor.agentId;
export const canonicalizerAgentId = canonicalizer.agentId;
export const brieferAgentId = briefer.agentId;

/** All three ids in one object so the app's `DEPOT_*_AGENT_ID` env can be
 *  populated from a single `pulumi stack output agentIds`. */
export const agentIds = {
	extractor: extractor.agentId,
	canonicalizer: canonicalizer.agentId,
	briefer: briefer.agentId,
};
