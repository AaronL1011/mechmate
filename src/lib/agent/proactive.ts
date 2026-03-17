import type { Kysely } from 'kysely';
import type { Database } from '$lib/types/db.js';
import { runAgentTurn } from './runtime.js';
import { FunctionExecutor } from './executor.js';
import { PROACTIVE_SYSTEM_PROMPT } from './prompts.js';
import type { LLMMessage } from '$lib/services/llm.js';

export async function runProactiveAgent(db: Kysely<Database>): Promise<string | null> {
	const executor = new FunctionExecutor({ db });
	const messages: LLMMessage[] = [
		{ role: 'system', content: PROACTIVE_SYSTEM_PROMPT },
		{
			role: 'user',
			content:
				'Produce the four sections: due/overdue summary, parts and supplies to order, preventative maintenance tips, and 1–3 priorities. Use only query tools.'
		}
	];

	const result = await runAgentTurn(db, messages, executor, PROACTIVE_SYSTEM_PROMPT, {
		queryOnly: true,
		maxIterations: 5
	});

	if (result.error) {
		console.error('Proactive agent error:', result.error);
		return null;
	}

	const text = result.message ?? null;
	if (text) {
		await storeProactiveResult(db, text);
	}
	return text;
}

export async function storeProactiveResult(
	db: Kysely<Database>,
	result: string
): Promise<void> {
	await db.insertInto('proactive_suggestions').values({ result }).execute();
}

export async function getLatestProactiveResult(
	db: Kysely<Database>
): Promise<{ result: string; created_at: string } | null> {
	const row = await db
		.selectFrom('proactive_suggestions')
		.select(['result', 'created_at'])
		.orderBy('id', 'desc')
		.limit(1)
		.executeTakeFirst();
	if (!row) return null;
	return { result: row.result, created_at: String(row.created_at) };
}
