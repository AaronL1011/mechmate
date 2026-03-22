import { createHash } from 'crypto';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Database, ProactiveSuggestion } from '$lib/types/db.js';
import { equipmentRepository } from '$lib/repositories.js';
import { runAgentTurn, type ResponseOutputFormat } from './runtime.js';
import { FunctionExecutor } from './executor.js';
import { getProactiveSystemPrompt } from './prompts.js';
import type { LLMMessage } from '$lib/services/llm.js';
import {
	PROACTIVE_MAX_ACTIVE_SUGGESTIONS,
	type ProactiveSection
} from './proactiveShared.js';

export { PROACTIVE_MAX_ACTIVE_SUGGESTIONS, type ProactiveSection } from './proactiveShared.js';

export const STARTER_SECTION_TITLE_PREFIX = 'Starter tasks for ';
const MAX_AGENT_ACTION_LABEL_LEN = 40;

function truncateAgentActionLabel(text: string): string {
	const t = text.trim();
	if (t.length <= MAX_AGENT_ACTION_LABEL_LEN) return t;
	return `${t.slice(0, MAX_AGENT_ACTION_LABEL_LEN - 1)}…`;
}

async function enforceProactiveActiveCap(db: Kysely<Database>): Promise<void> {
	const rows = await db
		.selectFrom('proactive_suggestions')
		.select('id')
		.where('dismissed_at', 'is', null)
		.orderBy('id', 'desc')
		.execute();
	if (rows.length <= PROACTIVE_MAX_ACTIVE_SUGGESTIONS) return;
	const toDismiss = rows.slice(PROACTIVE_MAX_ACTIVE_SUGGESTIONS).map((r) => r.id);
	await db
		.updateTable('proactive_suggestions')
		.set({ dismissed_at: new Date().toISOString() })
		.where('id', 'in', toDismiss)
		.execute();
}

async function getEquipmentWithNoTasks(
	db: Kysely<Database>
): Promise<Array<{ id: number; name: string }>> {
	const equipment = await equipmentRepository.getAll(db);
	if (equipment.length === 0) return [];
	const rows = await db.selectFrom('tasks').select('equipment_id').distinct().execute();
	const withTasks = new Set(rows.map((r) => r.equipment_id));
	return equipment
		.filter((e) => !withTasks.has(e.id))
		.map((e) => ({ id: e.id, name: e.name }))
		.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function buildStarterTaskSections(
	bareEquipment: Array<{ id: number; name: string }>,
	existingSuggestions: Array<{ title: string; content: string }>
): ProactiveSection[] {
	const sections: ProactiveSection[] = [];
	for (const eq of bareEquipment) {
		const title = `${STARTER_SECTION_TITLE_PREFIX}${eq.name}`;
		if (existingSuggestions.some((s) => s.title === title)) continue;
		sections.push({
			title,
			content: `**${eq.name}** has no maintenance tasks yet. Want to have Mech draft a starter schedule you can review and confirm?`,
			agent_action: `Propose a starter maintenance schedule for ${eq.name} (equipment id: ${eq.id}).`,
			agent_action_label: "create schedule"
		});
	}
	return sections;
}

function mergeProactiveSections(
	starterSections: ProactiveSection[],
	llmSections: ProactiveSection[]
): ProactiveSection[] {
	return [...starterSections, ...llmSections].slice(0, PROACTIVE_MAX_ACTIVE_SUGGESTIONS);
}

export const PROACTIVE_SECTIONS_RESPONSE_FORMAT: ResponseOutputFormat = {
	type: 'json_schema',
	schema: {
		name: 'ProactiveSections',
		strict: true,
		schema: {
			type: 'object',
			properties: {
				sections: { 
					type: 'array', 
					items: { 
						type: 'object', 
						properties: { 
							title: { type: 'string' }, 
							content: { type: 'string' }, 
							agent_action: { type: 'string' },
							agent_action_label: { type: 'string' }
						},
						required: ['title', 'content']
					} 
				}
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

	await enforceProactiveActiveCap(db);

	const existingRows = await db
		.selectFrom('proactive_suggestions')
		.select('result')
		.where('dismissed_at', 'is', null)
		.orderBy('id', 'desc')
		.limit(PROACTIVE_MAX_ACTIVE_SUGGESTIONS)
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
	}

	const structured = result.structuredMessage as { sections?: ProactiveSection[] } | undefined;
	const sections = structured?.sections;

	const llmSections =
		result.error || !Array.isArray(sections)
			? []
			: sections.filter(
					(s): s is ProactiveSection =>
						typeof s === 'object' &&
						s !== null &&
						typeof (s as ProactiveSection).title === 'string' &&
						typeof (s as ProactiveSection).content === 'string'
				);

	const bareEquipment = await getEquipmentWithNoTasks(db);
	const starterSections = buildStarterTaskSections(bareEquipment, existingSuggestions);
	const merged = mergeProactiveSections(starterSections, llmSections);

	if (merged.length > 0) {
		await storeProactiveResults(db, merged, currentHash);
		return JSON.stringify(merged);
	}

	if (result.error) {
		return null;
	}

	return 'Could not generate proactive suggestions';
}

export async function storeProactiveResults(
	db: Kysely<Database>,
	sections: ProactiveSection[],
	contentHash: string
): Promise<void> {
	// Insert last-to-first so typical `orderBy(id desc)` feeds match merge order (starters before LLM sections).
	await db
		.insertInto('proactive_suggestions')
		.values(
			[...sections].reverse().map((s) => ({ result: JSON.stringify(s), content_hash: contentHash }))
		)
		.execute();
	await enforceProactiveActiveCap(db);
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
	await enforceProactiveActiveCap(db);
	const rows = await db
		.selectFrom('proactive_suggestions')
		.select(['id', 'result', 'created_at'])
		.where('dismissed_at', 'is', null)
		.orderBy('id', 'desc')
		.limit(PROACTIVE_MAX_ACTIVE_SUGGESTIONS)
		.execute();
	return rows.map(r => ({
		id: r.id,
		result: r.result,
		created_at: r.created_at,
		dismissed_at: null,
		content_hash: null
	}));
}
