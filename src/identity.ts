/**
 * Machine + Claude-account identity.
 *
 * Machine: a random UUID minted once and persisted in the state dir, mixed with
 * the hostname so the same physical host has one stable fingerprint.
 *
 * Account: discovered READ-ONLY from `~/.claude.json` (the canonical location
 * of the signed-in Claude account — `oauthAccount.accountUuid` / `.emailAddress`
 * and the top-level `userID`). We NEVER read or transmit tokens. Falls back to
 * `DEPOT_ACCOUNT_ID`, then the OS username.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type Machine = { fingerprint: string; hostname?: string; os?: string };
export type Account = {
	vendor: "anthropic";
	vendorAccountId: string;
	email?: string;
	/** How the id was resolved — for the CLI summary, never uploaded. */
	source: "claude.json" | "env" | "username";
};

function safeReadJson(file: string): unknown {
	try {
		const text = fs.readFileSync(file, "utf8");
		return JSON.parse(text) as unknown;
	} catch {
		return null;
	}
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (typeof value === "object" && value !== null && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return null;
}

function asString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Stable machine fingerprint. The UUID is minted once and stored at
 * `<stateDir>/machine.json`; the wire fingerprint mixes it with the hostname so
 * it stays stable across runs but distinct per host.
 */
export function resolveMachine(stateDir: string): Machine {
	const file = path.join(stateDir, "machine.json");
	let installId: string | undefined;

	const existing = asRecord(safeReadJson(file));
	if (existing) {
		installId = asString(existing.installId);
	}

	if (!installId) {
		installId = crypto.randomUUID();
		try {
			fs.mkdirSync(stateDir, { recursive: true });
			fs.writeFileSync(
				file,
				`${JSON.stringify({ installId, createdAt: new Date().toISOString() }, null, 2)}\n`,
				{ mode: 0o600 },
			);
		} catch {
			// Non-fatal: a fresh UUID per run is worse but still works. The server
			// dedups records by uuid regardless of machine.
		}
	}

	let hostname: string | undefined;
	try {
		hostname = os.hostname() || undefined;
	} catch {
		hostname = undefined;
	}

	const fingerprint = crypto
		.createHash("sha256")
		.update(`${installId}|${hostname ?? ""}`)
		.digest("hex");

	return { fingerprint, hostname, os: process.platform };
}

/**
 * Resolve the Claude account identity, READ-ONLY and secret-free.
 *
 * Priority: explicit `DEPOT_ACCOUNT_ID` → `~/.claude.json` oauthAccount/userID
 * → OS username. Only non-secret fields (account uuid, email, user id) are ever
 * read; tokens in `~/.claude/.credentials.json` are deliberately untouched.
 */
export function resolveAccount(accountIdOverride: string | null): Account {
	if (accountIdOverride) {
		return {
			vendor: "anthropic",
			vendorAccountId: accountIdOverride,
			source: "env",
		};
	}

	const claudeJson = asRecord(safeReadJson(path.join(os.homedir(), ".claude.json")));
	if (claudeJson) {
		const oauth = asRecord(claudeJson.oauthAccount);
		const accountUuid = oauth ? asString(oauth.accountUuid) : undefined;
		const email = oauth ? asString(oauth.emailAddress) : undefined;
		const userId = asString(claudeJson.userID);

		const vendorAccountId = accountUuid ?? userId;
		if (vendorAccountId) {
			return {
				vendor: "anthropic",
				vendorAccountId,
				email,
				source: "claude.json",
			};
		}
	}

	let username = "unknown";
	try {
		username = os.userInfo().username || username;
	} catch {
		// keep fallback
	}
	return {
		vendor: "anthropic",
		vendorAccountId: `username:${username}`,
		source: "username",
	};
}
