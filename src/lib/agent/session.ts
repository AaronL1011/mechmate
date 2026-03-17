import { v4 as uuidv4 } from 'uuid';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Database, AgentSession, NewAgentSession, NewAgentTurn } from '$lib/types/db.js';
import type { LLMMessage } from '$lib/services/llm.js';

const DEFAULT_LAST_N_TURNS = 20;

export async function createSession(
	db: Kysely<Database>,
	id: string,
	source: string = 'chat'
): Promise<AgentSession> {
	const row: NewAgentSession = {
		id,
		source
	};
	return db
		.insertInto('agent_sessions')
		.values(row)
		.returningAll()
		.executeTakeFirstOrThrow();
}

export async function getSession(
	db: Kysely<Database>,
	id: string
): Promise<AgentSession | undefined> {
	return db
		.selectFrom('agent_sessions')
		.selectAll()
		.where('id', '=', id)
		.executeTakeFirst();
}

export async function getLastTurns(
	db: Kysely<Database>,
	sessionId: string,
	n: number = DEFAULT_LAST_N_TURNS
): Promise<LLMMessage[]> {
	const rows = await db
		.selectFrom('agent_turns')
		.selectAll()
		.where('session_id', '=', sessionId)
		.orderBy('id', 'desc')
		.limit(n)
		.execute();

	const ordered = rows.reverse();
	return ordered.map((row) => ({
		role: row.role as LLMMessage['role'],
		content: row.content,
		...(row.tool_calls ? { tool_calls: JSON.parse(row.tool_calls) } : {}),
		...(row.tool_call_id ? { tool_call_id: row.tool_call_id } : {})
	}));
}

export async function appendTurn(
	db: Kysely<Database>,
	sessionId: string,
	role: string,
	content: string,
	toolCalls?: unknown,
	toolCallId?: string | null
): Promise<void> {
	const row: NewAgentTurn = {
		session_id: sessionId,
		role,
		content,
		tool_calls: toolCalls != null ? JSON.stringify(toolCalls) : null,
		tool_call_id: toolCallId ?? null
	};
	await db.insertInto('agent_turns').values(row).execute();
	await db
		.updateTable('agent_sessions')
		.set({ updated_at: sql`CURRENT_TIMESTAMP` })
		.where('id', '=', sessionId)
		.execute();
}

export async function appendTurnsFromHistory(
	db: Kysely<Database>,
	sessionId: string,
	messages: LLMMessage[]
): Promise<void> {
	for (const msg of messages) {
		const content = typeof msg.content === 'string' ? msg.content : '';
		await appendTurn(
			db,
			sessionId,
			msg.role,
			content,
			msg.tool_calls ?? undefined,
			msg.tool_call_id ?? null
		);
	}
}

export async function ensureSession(
	db: Kysely<Database>,
	sessionId: string | undefined
): Promise<string> {
	if (sessionId) {
		const existing = await getSession(db, sessionId);
		if (existing) return sessionId;
	}
	const id = uuidv4();
	await createSession(db, id, 'chat');
	return id;
}
