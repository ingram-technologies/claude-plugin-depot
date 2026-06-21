/**
 * Pure fork-detection logic, separated from DB access for unit testing.
 *
 * A session is a fork when one of its records points (via parentUuid) at a
 * record that belongs to a DIFFERENT session. The fork point is the earliest
 * such record (by seq order).
 */

export type ForkCandidate = {
	uuid: string;
	parentUuid: string | null;
};

export type ForkResult = {
	forkedFromSessionId: string;
	forkPointRecordUuid: string;
};

/**
 * @param ownUuids        uuids belonging to THIS session.
 * @param candidates      this session's records, in seq order (earliest first).
 * @param parentSession   maps a parentUuid → the session id that owns it, ONLY
 *                        for parents that belong to a different session.
 */
export function findForkPoint(
	ownUuids: ReadonlySet<string>,
	candidates: readonly ForkCandidate[],
	parentSession: (parentUuid: string) => string | undefined,
): ForkResult | null {
	for (const c of candidates) {
		const parent = c.parentUuid;
		if (!parent) {
			continue;
		}
		if (ownUuids.has(parent)) {
			continue; // internal edge, not a fork
		}
		const owner = parentSession(parent);
		if (!owner) {
			continue; // parent unknown (records out of order) — not yet a fork
		}
		return { forkedFromSessionId: owner, forkPointRecordUuid: parent };
	}
	return null;
}
