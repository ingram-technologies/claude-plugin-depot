"use server";

/**
 * Curation server action — one human confirm/dispute/outdated outranks any AI
 * confidence. Writes an `entry_curation` row attributed to the viewer, and
 * stamps `last_confirmed_at` on a confirm (which keeps a Memory lit). Status
 * shifts on dispute (→ contested) / outdated (→ retired).
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { execute, maybeOne } from "@/lib/db";
import { newId } from "@/lib/ids";
import { getViewer } from "./session";

const curateSchema = z.object({
	entryId: z.string().min(1).max(64),
	action: z.enum(["confirm", "dispute", "outdated"]),
	note: z.string().max(2000).optional(),
});

export type CurateInput = z.infer<typeof curateSchema>;
export type CurateResult = { ok: true } | { ok: false; error: string };

export async function curateEntry(input: unknown): Promise<CurateResult> {
	const parsed = curateSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "Invalid curation input." };
	}
	const viewer = await getViewer();
	if (!viewer) {
		return { ok: false, error: "Not signed in." };
	}

	const { entryId, action, note } = parsed.data;

	const entry = await maybeOne<{ id: string; slug: string }>(
		`select id, slug from knowledge_entry where id = $1`,
		[entryId],
	);
	if (!entry) {
		return { ok: false, error: "Memory not found." };
	}

	await execute(
		`insert into entry_curation (id, entry_id, person_id, action, note)
		 values ($1, $2, $3, $4, $5)`,
		[newId("curation"), entryId, viewer.personId, action, note ?? null],
	);

	if (action === "confirm") {
		await execute(
			`update knowledge_entry set last_confirmed_at = now(), updated_at = now()
			 where id = $1`,
			[entryId],
		);
	} else if (action === "dispute") {
		await execute(
			`update knowledge_entry set status = 'contested', updated_at = now()
			 where id = $1 and status = 'active'`,
			[entryId],
		);
	} else if (action === "outdated") {
		await execute(
			`update knowledge_entry set status = 'retired', updated_at = now()
			 where id = $1`,
			[entryId],
		);
	}

	revalidatePath(`/m/${entryId}`);
	return { ok: true };
}
