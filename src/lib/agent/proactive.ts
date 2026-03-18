import { createHash } from 'crypto';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Database, ProactiveSuggestion } from '$lib/types/db.js';
import { runAgentTurn, type ResponseOutputFormat } from './runtime.js';
import { FunctionExecutor } from './executor.js';
import { getProactiveSystemPrompt } from './prompts.js';
import type { LLMMessage } from '$lib/services/llm.js';

export interface ProactiveSection {
	title: string;
	content: string;
}

export const PROACTIVE_SECTIONS_RESPONSE_FORMAT: ResponseOutputFormat = {
	type: 'json_schema',
	schema: {
		name: 'ProactiveSections',
		strict: true,
		schema: {
			type: 'object',
			properties: {
				sections: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' } } } }
			}
		}
	}
};

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

	const existingRows = await db
		.selectFrom('proactive_suggestions')
		.select('result')
		.where('dismissed_at', 'is', null)
		.orderBy('id', 'desc')
		.execute();

	const existingSuggestions = existingRows.flatMap(row => {
		try {
			const parsed = JSON.parse(row.result) as { title?: string; content?: string };
			if (parsed?.title && parsed?.content) {
				return [{ title: parsed.title, content: parsed.content }];
			}
		} catch {
			// malformed row — skip
		}
		return [];
	});

	const systemPrompt = getProactiveSystemPrompt(toneContext ?? '', existingSuggestions);
	const executor = new FunctionExecutor({ db });
	const messages: LLMMessage[] = [
		{ role: 'system', content: systemPrompt },
	];

	const result = await runAgentTurn(db, messages, executor, systemPrompt, {
		queryOnly: true,
		maxIterations: 5,
		responseFormat: PROACTIVE_SECTIONS_RESPONSE_FORMAT
	});

	if (result.error) {
		console.error('Proactive agent error:', result.error);
		return null;
	}

	const structured = result.structuredMessage as { sections?: ProactiveSection[] } | undefined;
	const sections = structured?.sections;
	const text = result.message ?? null;

	if (sections && Array.isArray(sections) && sections.length > 0) {
		const validSections = sections.filter(
			(s): s is ProactiveSection =>
				typeof s === 'object' &&
				s !== null &&
				typeof (s as ProactiveSection).title === 'string' &&
				typeof (s as ProactiveSection).content === 'string'
		);
		if (validSections.length > 0) {
			await storeProactiveResults(db, validSections, currentHash);
			return JSON.stringify(validSections);
		}
	}

	return 'Could not generate proactive suggestions';
}

export async function storeProactiveResults(
	db: Kysely<Database>,
	sections: ProactiveSection[],
	contentHash: string
): Promise<void> {
	await db
		.insertInto('proactive_suggestions')
		.values(sections.map(s => ({ result: JSON.stringify(s), content_hash: contentHash })))
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

export async function getLatestProactiveResults(
	db: Kysely<Database>
): Promise<ProactiveSuggestion[]> {
	const rows = await db
		.selectFrom('proactive_suggestions')
		.select(['id', 'result', 'created_at'])
		.where('dismissed_at', 'is', null)
		.orderBy('id', 'desc')
		.execute();
	return rows.map(r => ({
		id: r.id,
		result: r.result,
		created_at: r.created_at,
		dismissed_at: null,
		content_hash: null
	}));
}
