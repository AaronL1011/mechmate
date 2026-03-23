import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Database, AgentPendingAction, NewAgentPendingAction } from '$lib/types/db.js';
import type { ActionResult } from './executor.js';

const DEFAULT_TTL_MS = 2 * 60 * 1000;

export function createPendingAction(
	db: Kysely<Database>,
	id: string,
	payload: ActionResult,
	sessionId: string | null,
	ttlMs: number = DEFAULT_TTL_MS
): Promise<AgentPendingAction> {
	const expiresAt = new Date(Date.now() + ttlMs).toISOString();
	const row: NewAgentPendingAction = {
		id,
		session_id: sessionId,
		payload: JSON.stringify(payload),
		status: 'pending',
		expires_at: expiresAt
	};
	return db
		.insertInto('agent_pending_actions')
		.values(row)
		.returningAll()
		.executeTakeFirstOrThrow();
}

export async function getPendingAction(
	db: Kysely<Database>,
	id: string
): Promise<{ action: ActionResult; expiresAt: string } | null> {
	const row = await db
		.selectFrom('agent_pending_actions')
		.selectAll()
		.where('id', '=', id)
		.where('status', '=', 'pending')
		.executeTakeFirst();
	if (!row) return null;
	const action = JSON.parse(row.payload) as ActionResult;
	return { action, expiresAt: String(row.expires_at) };
}

export function resolvePendingAction(
	db: Kysely<Database>,
	id: string,
	status: 'confirmed' | 'cancelled' | 'executed'
): Promise<AgentPendingAction | undefined> {
	return db
		.updateTable('agent_pending_actions')
		.set({ status })
		.where('id', '=', id)
		.returningAll()
		.executeTakeFirst();
}

export function deleteExpiredPendingActions(db: Kysely<Database>): Promise<number> {
	const now = new Date().toISOString();
	return db
		.deleteFrom('agent_pending_actions')
		.where(sql<boolean>`expires_at < ${now}`)
		.execute()
		.then((r) => r.length);
}
