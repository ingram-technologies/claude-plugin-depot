/**
 * Better Auth — employee login + organization tenancy for the web UI.
 *
 * - Shares the one TLS-aware pg pool from `@/lib/db` (Better Auth + queries).
 * - Uses the drizzle adapter pointed at our `auth_`-prefixed tables
 *   (`auth-schema.ts`) so Better Auth never collides with the domain
 *   `session` / `account` tables and drizzle-kit can track its migrations.
 * - Email + password is the baseline; Google social login is wired only when
 *   both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set. GitHub stays as an
 *   optional provider, also conditional.
 * - The organization plugin provides the tenant model (orgs, members, roles,
 *   invitations) with owner/admin/member access control from `permissions.ts`.
 *
 * Active-org hook: nk-auth's `lastActiveOrganizationHooks` runs raw SQL against
 * Better Auth's default table/column names (`"user"`, `member`,
 * `"lastActiveOrganizationId"`, camelCase). Our tables are `auth_*` with
 * snake_case columns, so that hook is incompatible — we use a custom
 * `session.create.before` (mirroring cloud.ingram.tech) written against our
 * own `auth_member` / `auth_user` tables. We DO reuse the table-name-agnostic
 * pieces (`authBasePath`, `nkOrganizationDefaults`,
 * `lastActiveOrganizationUserField`) since those are plugin options / field
 * defs, not raw SQL.
 */

import {
	lastActiveOrganizationUserField,
	nkOrganizationDefaults,
} from "@ingram-tech/nk-auth/organization";
import { authBasePath } from "@ingram-tech/nk-auth/paths";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/node-postgres";

import * as authSchema from "@/lib/auth-schema";
import { pool } from "@/lib/db";
import { sendInvitationEmail } from "@/lib/email/invitation";
import { sendVerificationEmail } from "@/lib/email/verification";
import { accessControl, admin, member, owner } from "@/lib/permissions";

const authDb = drizzle(pool, { schema: authSchema });

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const socialProviders = {
	...(googleClientId && googleClientSecret
		? {
				google: {
					clientId: googleClientId,
					clientSecret: googleClientSecret,
				},
			}
		: {}),
	...(githubClientId && githubClientSecret
		? {
				github: {
					clientId: githubClientId,
					clientSecret: githubClientSecret,
				},
			}
		: {}),
};

/**
 * The user's first organization (oldest membership). Used to default the active
 * org on a fresh session so the tenant is set right after login. Written
 * against OUR `auth_member` table (snake_case columns), not Better Auth's
 * default `member`.
 */
async function firstOrganizationId(userId: string): Promise<string | null> {
	const { rows } = await pool.query<{ organization_id: string }>(
		`SELECT organization_id FROM auth_member WHERE user_id = $1
		 ORDER BY created_at ASC LIMIT 1`,
		[userId],
	);
	return rows[0]?.organization_id ?? null;
}

export const auth = betterAuth({
	// Mount under /auth (nextkit convention), not the framework default
	// /api/auth. Login + OAuth callbacks live at <site>/auth/...; Google's
	// redirect URI is therefore <BETTER_AUTH_URL>/auth/callback/google.
	basePath: authBasePath,
	baseURL: process.env.BETTER_AUTH_URL,
	secret: process.env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(authDb, {
		provider: "pg",
		schema: {
			user: authSchema.authUser,
			session: authSchema.authSession,
			account: authSchema.authAccount,
			verification: authSchema.authVerification,
			organization: authSchema.authOrganization,
			member: authSchema.authMember,
			invitation: authSchema.authInvitation,
		},
	}),
	emailAndPassword: {
		enabled: true,
		// Require a verified email before a password account can sign in. This is
		// what makes same-email Google login safe to AUTO-LINK: Better Auth's
		// default `account.accountLinking.requireLocalEmailVerified` (true) only
		// merges a social login into an existing account once that account's email
		// is verified. Without this, an unverified password row for someone else's
		// address would block their Google login with `account_not_linked` (the
		// bug we hit) — or, worse, if we'd "fixed" it by trusting Google, let an
		// attacker's unverified row absorb the real owner's identity.
		requireEmailVerification: true,
	},
	emailVerification: {
		// Send on sign-up and (Better Auth does this automatically) on any sign-in
		// attempt by an unverified account, so the link is always one click away.
		sendOnSignUp: true,
		// Once verified, drop the user straight into a session — no second login.
		autoSignInAfterVerification: true,
		expiresIn: 60 * 60 * 24, // 24h
		async sendVerificationEmail({ user, url }) {
			await sendVerificationEmail({ email: user.email, name: user.name, url });
		},
	},
	account: {
		// Linking is implicitly enabled in Better Auth; we set it explicitly to
		// document the posture. We deliberately DO NOT list Google in
		// `trustedProviders` and keep `requireLocalEmailVerified` at its default
		// (true): a social account merges into an existing user only when BOTH the
		// provider's email and the local account's email are verified. Google
		// always returns a verified email, so once the password account is
		// verified the link is automatic — and an unverified local account can
		// never be silently taken over.
		accountLinking: {
			enabled: true,
		},
	},
	...(Object.keys(socialProviders).length > 0 ? { socialProviders } : {}),
	user: {
		additionalFields: { ...lastActiveOrganizationUserField },
	},
	session: {
		expiresIn: 60 * 60 * 24 * 30, // 30 days
		updateAge: 60 * 60 * 24, // refresh daily
	},
	plugins: [
		organization({
			...nkOrganizationDefaults,
			allowUserToCreateOrganization: true,
			ac: accessControl,
			roles: { owner, admin, member },
			// Best-effort invite email; sendInvitationEmail never throws, so a
			// send failure can't roll back the invitation (it still lands in the
			// in-app pending list).
			async sendInvitationEmail(data) {
				await sendInvitationEmail({
					invitationId: data.id,
					email: data.email,
					organizationName: data.organization.name,
					role: data.role,
					invitedByName: data.inviter.user.name ?? data.inviter.user.email,
				});
			},
		}),
		nextCookies(),
	],
	databaseHooks: {
		session: {
			create: {
				// Default the active org to the user's first membership so the
				// tenant is set right after login. New users get an org created
				// in the (app) layout's onboarding flow (owned by the UI agent).
				before: async (session) => {
					const activeOrganizationId = await firstOrganizationId(
						session.userId,
					);
					return { data: { ...session, activeOrganizationId } };
				},
			},
		},
	},
});
