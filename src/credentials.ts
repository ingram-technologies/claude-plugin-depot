/**
 * Locally-saved Depot credentials, written by `depot login` and read by the
 * uploader. Lives next to the cursor/state (`<stateDir>/credentials.json`,
 * mode 0600). `DEPOT_TOKEN` in the environment always overrides this file.
 */

import fs from "node:fs";
import path from "node:path";

export type Credentials = {
	token: string;
	depotUrl?: string;
	createdAt: string;
};

export function credentialsPath(stateDir: string): string {
	return path.join(stateDir, "credentials.json");
}

/** The saved token, or null if there is no (valid) credentials file. */
export function readSavedToken(stateDir: string): string | null {
	try {
		const raw = fs.readFileSync(credentialsPath(stateDir), "utf8");
		const parsed = JSON.parse(raw) as unknown;
		if (parsed && typeof parsed === "object") {
			const t = (parsed as Record<string, unknown>).token;
			if (typeof t === "string" && t.trim().length > 0) {
				return t.trim();
			}
		}
	} catch {
		// no file / unreadable / malformed → treat as "no saved token"
	}
	return null;
}

/** Persist the token (0600), creating the state dir if needed. */
export function saveToken(stateDir: string, token: string, depotUrl?: string): void {
	fs.mkdirSync(stateDir, { recursive: true });
	const body: Credentials = {
		token,
		...(depotUrl ? { depotUrl } : {}),
		// Caller stamps the time; kept simple to avoid importing a clock here.
		createdAt: new Date().toISOString(),
	};
	const target = credentialsPath(stateDir);
	const tmp = `${target}.tmp`;
	fs.writeFileSync(tmp, `${JSON.stringify(body, null, 2)}\n`, { mode: 0o600 });
	fs.renameSync(tmp, target);
}
