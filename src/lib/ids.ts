import { randomBytes } from "node:crypto";

/**
 * Prefixed, sortable-ish, URL-safe ids (à la Ingram Cloud's `agt_` / `proj_`).
 * Format: `<prefix>_<22 char base62>`. Generated in-app so identity never
 * depends on a non-deterministic external process.
 */

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const ID_PREFIXES = {
	person: "per",
	account: "acc",
	machine: "mch",
	project: "prj",
	projectPath: "pth",
	ingestToken: "tok",
	file: "fil",
	session: "ses",
	analysisRun: "run",
	claim: "kc",
	entry: "ke",
	evidence: "ev",
	curation: "cur",
	briefing: "brf",
} as const;

export type IdKind = keyof typeof ID_PREFIXES;

function base62(byteLength: number): string {
	const bytes = randomBytes(byteLength);
	let out = "";
	for (const b of bytes) {
		out += ALPHABET[b % 62];
	}
	return out;
}

export function newId(kind: IdKind): string {
	return `${ID_PREFIXES[kind]}_${base62(22)}`;
}
