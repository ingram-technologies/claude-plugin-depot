/**
 * Gate the (app) routes to signed-in employees. We do a cheap cookie-presence
 * check at the edge (Better Auth's session cookie) and redirect to /sign-in
 * otherwise — the actual session is validated in server components via
 * `auth.api.getSession`. This keeps middleware fast and avoids running the
 * node-postgres pool in the edge runtime.
 */

import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// Public to the session gate. /api/* carries its own bearer-token auth;
// /auth is the Better Auth handler; /internal is worker/cron plumbing.
const PUBLIC_PREFIXES = ["/sign-in", "/auth", "/api", "/internal"];

export function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;

	if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
		return NextResponse.next();
	}

	const sessionCookie = getSessionCookie(req);
	if (!sessionCookie) {
		const url = req.nextUrl.clone();
		url.pathname = "/sign-in";
		url.searchParams.set("next", pathname);
		return NextResponse.redirect(url);
	}

	return NextResponse.next();
}

export const config = {
	// Run on everything except Next internals and static assets.
	matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.\\w+$).*)"],
};
