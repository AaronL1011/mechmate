import { createHash } from 'crypto';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Database } from '$lib/types/db.js';
import { runAgentTurn } from './runtime.js';
import { FunctionExecutor } from './executor.js';
import { getProactiveSystemPrompt } from './prompts.js';
import type { LLMMessage } from '$lib/services/llm.js';

async function computeTaskStateHash(db: Kysely<Database>): Promise<string> {
	const tasks = await db
		.selectFrom('tasks')
		.select(['id', 'updated_at', 'next_due_date', 'status'])
		.orderBy('id')
		.execute();
	const equipment = await db
		.selectFrom('equipment')
		.select(['id', 'updated_at'])
		.orderBy('id')
		.execute();
	return createHash('sha256')
		.update(JSON.stringify({ tasks, equipment }))
		.digest('hex');
}

export async function runProactiveAgent(
	db: Kysely<Database>,
	options?: { toneContext?: string; skipChangeCheck?: boolean }
): Promise<string | null> {
	const { toneContext, skipChangeCheck = false } = options ?? {};

	const currentHash = await computeTaskStateHash(db);
	if (!skipChangeCheck) {
		const latest = await db
			.selectFrom('proactive_suggestions')
			.select('content_hash')
			.orderBy('id', 'desc')
			.limit(1)
			.executeTakeFirst();
		if (latest?.content_hash === currentHash) {
			return null;
		}
	}

	const systemPrompt = getProactiveSystemPrompt(toneContext ?? '');
	const executor = new FunctionExecutor({ db });
	const messages: LLMMessage[] = [
		{ role: 'system', content: systemPrompt },
		{
			role: 'user',
			content:
				'Produce the four sections: due/overdue summary, parts and supplies to order, preventative maintenance tips, and 1–3 priorities. Use only query tools.'
		}
	];

	const result = await runAgentTurn(db, messages, executor, systemPrompt, {
		queryOnly: true,
		maxIterations: 5
	});

	if (result.error) {
		console.error('Proactive agent error:', result.error);
		return null;
	}

	const text = result.message ?? null;
	if (text) {
		await storeProactiveResult(db, text, currentHash);
	}
	return text;
}

export async function storeProactiveResult(
	db: Kysely<Database>,
	result: string,
	contentHash: string
): Promise<void> {
	await db
		.insertInto('proactive_suggestions')
		.values({ result, content_hash: contentHash })
		.execute();
}

export async function pruneOldSuggestions(db: Kysely<Database>): Promise<number> {
	const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
	const result = await db
		.deleteFrom('proactive_suggestions')
		.where(sql<boolean>`created_at < ${cutoff}`)
		.execute();
	return result.length;
}

export async function dismissProactiveSuggestion(
	db: Kysely<Database>,
	id: number
): Promise<boolean> {
	const result = await db
		.updateTable('proactive_suggestions')
		.set({ dismissed_at: new Date().toISOString() })
		.where('id', '=', id)
		.execute();
	return result.length > 0;
}

export async function getLatestProactiveResult(
	db: Kysely<Database>
): Promise<{ id: number; result: string; created_at: string } | null> {
	const row = await db
		.selectFrom('proactive_suggestions')
		.select(['id', 'result', 'created_at'])
		.where('dismissed_at', 'is', null)
		.orderBy('id', 'desc')
		.limit(1)
		.executeTakeFirst();
	if (!row) return null;
	return { id: row.id, result: row.result, created_at: String(row.created_at) };
}
