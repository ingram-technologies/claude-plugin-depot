"use client";

import {
	inferAdditionalFields,
	organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { authBasePath } from "@ingram-tech/nk-auth/paths";

import type { auth } from "@/lib/auth";
import { accessControl, admin, member, owner } from "@/lib/permissions";

/**
 * Browser-side Better Auth client. Must point at the same basePath the server
 * mounts (`/auth`), not the framework default `/api/auth`. Carries the org
 * plugin (same access-control statements + roles as the server) and infers the
 * server's additional user fields (e.g. lastActiveOrganizationId).
 */
export const authClient = createAuthClient({
	basePath: authBasePath,
	plugins: [
		organizationClient({
			ac: accessControl,
			roles: { owner, admin, member },
		}),
		inferAdditionalFields<typeof auth>(),
	],
});

export const { signIn, signUp, signOut, useSession, organization } = authClient;
