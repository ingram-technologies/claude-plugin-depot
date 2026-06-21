import { createAccessControl } from "better-auth/plugins/access";
import {
	adminAc,
	defaultStatements,
	memberAc,
	ownerAc,
} from "better-auth/plugins/organization/access";

/**
 * Org-scoped access control for Depot. Static roles only (owner / admin /
 * member) — no dynamic per-org roles, so there's no organizationRole table.
 *
 * Shared by both the server (auth.ts) and the client (auth-client.ts), so this
 * module must stay free of server-only imports. `defaultStatements` carries
 * Better Auth's built-in organization / member / invitation statements; we
 * layer Depot's own resources on top.
 */

/** Depot-specific resources layered onto Better Auth's org statements. */
const DEPOT_STATEMENTS = {
	project: ["read", "create", "update", "delete"],
	memory: ["read", "curate", "delete"],
	token: ["read", "create", "revoke"],
} as const;

export const STATEMENTS = {
	...defaultStatements,
	...DEPOT_STATEMENTS,
} as const;

export const accessControl = createAccessControl(STATEMENTS);

const ALL_DEPOT = {
	project: [...DEPOT_STATEMENTS.project],
	memory: [...DEPOT_STATEMENTS.memory],
	token: [...DEPOT_STATEMENTS.token],
} as const;

/** Owner: god mode — every action on every resource. */
export const owner = accessControl.newRole({
	...ownerAc.statements,
	...ALL_DEPOT,
});

/** Admin: full org management + full Depot control. */
export const admin = accessControl.newRole({
	...adminAc.statements,
	...ALL_DEPOT,
});

/** Member: read-only Depot access. */
export const member = accessControl.newRole({
	...memberAc.statements,
	project: ["read"],
	memory: ["read"],
	token: ["read"],
});
