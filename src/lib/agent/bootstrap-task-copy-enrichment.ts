import type { CreateTaskRequest, Equipment, TaskType } from '$lib/types/db.js';
import { llmService, type LLMMessage, type LLMResponseFormat } from '$lib/services/llm.js';

const TITLE_MAX_LEN = 200;
const DESCRIPTION_MAX_LEN = 3500;

const RESPONSE_FORMAT: LLMResponseFormat = {
	type: 'json_schema',
	json_schema: {
		name: 'BootstrapTaskCopy',
		schema: {
			type: 'object',
			properties: {
				items: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							task_type_id: { type: 'number' },
							title: { type: 'string' },
							description: { type: 'string' }
						},
						required: ['task_type_id', 'title', 'description'],
						additionalProperties: false
					}
				}
			},
			required: ['items'],
			additionalProperties: false
		}
	}
};

function truncate(s: string, max: number): string {
	const t = s.trim();
	return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** UI already shows which asset tasks belong to; strip a leading "Name — …" if the model ignored instructions. */
function stripLeadingEquipmentNameFromTitle(title: string, equipmentName: string): string {
	const trimmed = title.trim();
	const name = equipmentName.trim();
	if (!name) return trimmed;
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const re = new RegExp(`^${escaped}\\s*(?:[—–:\\-|]\\s*)?`, 'i');
	const without = trimmed.replace(re, '').trim();
	return without.length >= 4 ? without : trimmed;
}

function equipmentSummary(
	equipment: Equipment,
	equipmentTypeName: string
): Record<string, unknown> {
	return {
		name: equipment.name,
		equipment_type: equipmentTypeName,
		make: equipment.make ?? null,
		model: equipment.model ?? null,
		year: equipment.year ?? null,
		usage_unit: equipment.usage_unit,
		current_usage_value: equipment.current_usage_value,
		purchase_date: equipment.purchase_date ?? null,
		location: equipment.location ?? null
	};
}

function taskPayloadForLlm(
	tasks: CreateTaskRequest[],
	taskTypeById: Map<number, TaskType>
): unknown[] {
	return tasks.map((t) => {
		const tt = taskTypeById.get(t.task_type_id);
		return {
			task_type_id: t.task_type_id,
			task_type_name: tt?.name ?? 'Unknown',
			task_type_catalog_description: tt?.description ?? null,
			time_interval_days: t.time_interval_days ?? null,
			usage_interval: t.usage_interval ?? null,
			priority: t.priority ?? 'medium',
			seed_title: t.title,
			seed_description: t.description ?? null
		};
	});
}

/**
 * Rewrites title and description for each bootstrap task using the LLM, tailored to the equipment.
 * On any failure, returns `tasks` unchanged.
 */
export async function enrichBootstrapTasksWithLlm(
	equipment: Equipment,
	equipmentTypeName: string,
	tasks: CreateTaskRequest[],
	taskTypeById: Map<number, TaskType>
): Promise<CreateTaskRequest[]> {
	if (!llmService.isConfigured() || tasks.length === 0) {
		return tasks;
	}

	const systemContent = `You write maintenance task titles and descriptions for Mechmate, a maintenance app.

Rules:
- Produce exactly one object per input row; keep the same task_type_id values. Do not add or remove rows.
- Titles: short, scannable maintenance names only. Do NOT include the equipment's display name, nickname, or "for [name]" phrasing—the list UI already shows which asset these belong to. Let make/model/year inform *what* the task is (e.g. timing belt vs serpentine) via ordinary words, not by prefixing the asset label. Good examples: "Engine oil & filter service", "Brake fluid flush", "HVAC filter & coil check". Bad: any title starting with the equipment name or repeating it.
- Under ${TITLE_MAX_LEN} characters. No trailing punctuation stacks.
- Descriptions: 2–4 short paragraphs or one tight block with blank lines between ideas. Concrete: what to inspect, typical signs of trouble, safety or OEM manual reminders where relevant. The description may mention the vehicle or machine by name where it reads naturally. Warm, professional, not robotic. Under ${DESCRIPTION_MAX_LEN} characters per description.
- Do not change intervals, priority, or task_type_id. Do not invent part numbers or guaranteed intervals beyond what the seed suggests.
- If seed_description is useful, you may refine and expand it; do not contradict the task type.`;

	const userContent = JSON.stringify(
		{
			equipment: equipmentSummary(equipment, equipmentTypeName),
			proposed_tasks: taskPayloadForLlm(tasks, taskTypeById)
		},
		null,
		2
	);

	const messages: LLMMessage[] = [
		{ role: 'system', content: systemContent },
		{ role: 'user', content: userContent }
	];

	try {
		const response = await llmService.completions({
			messages,
			response_format: RESPONSE_FORMAT,
			temperature: 0.45,
			max_tokens: 4096
		});

		const raw = response.choices[0]?.message?.content;
		if (!raw || typeof raw !== 'string') {
			console.warn('Bootstrap copy enrichment: empty LLM content');
			return tasks;
		}

		const parsed = JSON.parse(raw) as { items?: unknown };
		if (!Array.isArray(parsed.items)) {
			console.warn('Bootstrap copy enrichment: missing items array');
			return tasks;
		}

		const byTypeId = new Map<number, { title: string; description: string }>();
		for (const row of parsed.items) {
			if (!row || typeof row !== 'object') continue;
			const r = row as Record<string, unknown>;
			const id = typeof r.task_type_id === 'number' ? r.task_type_id : Number(r.task_type_id);
			if (!Number.isFinite(id)) continue;
			const title = typeof r.title === 'string' ? r.title : '';
			const description = typeof r.description === 'string' ? r.description : '';
			if (title.trim()) {
				byTypeId.set(id, { title: title.trim(), description: description.trim() });
			}
		}

		return tasks.map((t) => {
			const hit = byTypeId.get(t.task_type_id);
			if (!hit) return t;
			const cleanedTitle = stripLeadingEquipmentNameFromTitle(hit.title, equipment.name);
			return {
				...t,
				title: truncate(cleanedTitle, TITLE_MAX_LEN),
				...(hit.description ? { description: truncate(hit.description, DESCRIPTION_MAX_LEN) } : {})
			};
		});
	} catch (err) {
		console.warn('Bootstrap copy enrichment failed, using template copy:', err);
		return tasks;
	}
}
