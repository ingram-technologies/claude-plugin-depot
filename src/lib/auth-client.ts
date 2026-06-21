/**
 * Browser-side Better Auth client. Must point at the same basePath the server
 * mounts (`/auth`), not the framework default `/api/auth`.
 */

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	basePath: "/auth",
});

export const { signIn, signUp, signOut, useSession } = authClient;
