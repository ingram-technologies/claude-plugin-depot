/**
 * Better Auth — employee login for the web UI.
 *
 * - Shares the one TLS-aware pg pool from `@/lib/db` (Better Auth + queries).
 * - Uses the drizzle adapter pointed at our `auth_`-prefixed tables
 *   (`auth-schema.ts`) so Better Auth never collides with the domain
 *   `session` / `account` tables and drizzle-kit can track its migrations.
 * - Email + password is the baseline.
 * - GitHub OAuth org-gating: wired only when GITHUB_CLIENT_ID is present.
 *   TODO(org-gate): once we have an org allow-list, reject sign-ins whose
 *   GitHub org membership isn't in it (via a databaseHooks before-create hook
 *   that calls the GitHub API with the account access token).
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/node-postgres";

import { pool } from "@/lib/db";
import * as authSchema from "@/lib/auth-schema";

const authDb = drizzle(pool, { schema: authSchema });

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

const socialProviders =
	githubClientId && githubClientSecret
		? {
				github: {
					clientId: githubClientId,
					clientSecret: githubClientSecret,
				},
			}
		: undefined;

export const auth = betterAuth({
	// Mount under /auth (nextkit convention), not the framework default
	// /api/auth. Login + OAuth callbacks live at <site>/auth/...
	basePath: "/auth",
	baseURL: process.env.BETTER_AUTH_URL,
	secret: process.env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(authDb, {
		provider: "pg",
		schema: {
			user: authSchema.authUser,
			session: authSchema.authSession,
			account: authSchema.authAccount,
			verification: authSchema.authVerification,
		},
	}),
	emailAndPassword: {
		enabled: true,
		// Internal tool: don't block first sign-in on email verification.
		requireEmailVerification: false,
	},
	...(socialProviders ? { socialProviders } : {}),
	session: {
		expiresIn: 60 * 60 * 24 * 30, // 30 days
		updateAge: 60 * 60 * 24, // refresh daily
	},
});
