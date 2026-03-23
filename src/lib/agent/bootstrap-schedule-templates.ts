import type { CreateTaskRequest, Task, TaskType } from '$lib/types/db.js';

export type BootstrapRecipeEntry = {
	task_type_name: string;
	title: string;
	description?: string;
	time_interval_days?: number;
	usage_interval?: number;
	priority?: CreateTaskRequest['priority'];
};

function normalizeTaskTypeName(name: string): string {
	return name.trim().toLowerCase();
}

/** Recipes use `task_types.name` strings only; IDs are resolved at runtime from the DB. */
const RECIPES: Record<number, BootstrapRecipeEntry[]> = {
	1: [
		{
			task_type_name: 'Fluid Change',
			title: 'Fluid change',
			description: 'Drain and refill fluids per manufacturer guidance.',
			time_interval_days: 180,
			priority: 'high'
		},
		{
			task_type_name: 'Filter Replacement',
			title: 'Filter replacement',
			time_interval_days: 365,
			priority: 'medium'
		},
		{
			task_type_name: 'General Inspection',
			title: 'General inspection',
			time_interval_days: 90,
			priority: 'medium'
		},
		{
			task_type_name: 'Lubrication',
			title: 'Lubrication',
			time_interval_days: 180,
			priority: 'low'
		},
		{
			task_type_name: 'Wear-Part Replacement',
			title: 'Wear-part check',
			description: 'Inspect wear items (pads, belts, tires) and replace as needed.',
			time_interval_days: 365,
			priority: 'medium'
		},
		{
			task_type_name: 'Fastener Torque Check',
			title: 'Fastener torque check',
			time_interval_days: 180,
			priority: 'low'
		}
	],
	2: [
		{
			task_type_name: 'General Inspection',
			title: 'General inspection',
			time_interval_days: 180,
			priority: 'medium'
		},
		{
			task_type_name: 'Cleaning',
			title: 'Deep clean',
			time_interval_days: 90,
			priority: 'low'
		},
		{
			task_type_name: 'Filter Replacement',
			title: 'Filter replacement',
			time_interval_days: 365,
			priority: 'medium'
		},
		{
			task_type_name: 'Electrical / Battery Service',
			title: 'Electrical check',
			time_interval_days: 365,
			priority: 'medium'
		}
	],
	3: [
		{
			task_type_name: 'General Inspection',
			title: 'General inspection',
			time_interval_days: 90,
			priority: 'medium'
		},
		{
			task_type_name: 'Lubrication',
			title: 'Lubrication',
			time_interval_days: 180,
			priority: 'medium'
		},
		{
			task_type_name: 'Calibration / Alignment',
			title: 'Calibration / alignment',
			time_interval_days: 365,
			priority: 'medium'
		}
	],
	4: [
		{
			task_type_name: 'General Inspection',
			title: 'System inspection',
			time_interval_days: 90,
			priority: 'high'
		},
		{
			task_type_name: 'Filter Replacement',
			title: 'Filter replacement',
			time_interval_days: 180,
			priority: 'medium'
		},
		{
			task_type_name: 'Fluid Change',
			title: 'Fluid service',
			time_interval_days: 365,
			priority: 'medium'
		}
	],
	5: [
		{
			task_type_name: 'Cleaning',
			title: 'Cleaning',
			time_interval_days: 30,
			priority: 'low'
		},
		{
			task_type_name: 'Software / Firmware Update',
			title: 'Software / firmware update',
			time_interval_days: 90,
			priority: 'medium'
		},
		{
			task_type_name: 'Electrical / Battery Service',
			title: 'Battery / power check',
			time_interval_days: 180,
			priority: 'medium'
		}
	],
	6: [
		{
			task_type_name: 'General Inspection',
			title: 'General inspection',
			time_interval_days: 90,
			priority: 'medium'
		},
		{
			task_type_name: 'Cleaning',
			title: 'Cleaning',
			time_interval_days: 180,
			priority: 'low'
		}
	]
};

const FALLBACK_EQUIPMENT_TYPE_ID = 6;

export function taskTypesByNormalizedName(taskTypes: TaskType[]): Map<string, TaskType> {
	const map = new Map<string, TaskType>();
	for (const row of taskTypes) {
		const key = normalizeTaskTypeName(row.name);
		if (!map.has(key)) map.set(key, row);
	}
	return map;
}

export function buildBootstrapTasksForEquipment(
	equipmentId: number,
	equipmentTypeId: number,
	taskTypes: TaskType[],
	existingTasks: Task[]
): {
	tasks: CreateTaskRequest[];
	skipped_unresolved_type_names: string[];
	skipped_duplicate_task_type_ids: number[];
} {
	const recipe = RECIPES[equipmentTypeId] ?? RECIPES[FALLBACK_EQUIPMENT_TYPE_ID] ?? [];
	const byName = taskTypesByNormalizedName(taskTypes);
	const existingTypeIds = new Set(existingTasks.map((t) => t.task_type_id));

	const tasks: CreateTaskRequest[] = [];
	const skipped_unresolved_type_names: string[] = [];
	const skipped_duplicate_task_type_ids: number[] = [];

	for (const entry of recipe) {
		const match = byName.get(normalizeTaskTypeName(entry.task_type_name));
		if (!match) {
			skipped_unresolved_type_names.push(entry.task_type_name);
			continue;
		}
		if (existingTypeIds.has(match.id)) {
			skipped_duplicate_task_type_ids.push(match.id);
			continue;
		}

		tasks.push({
			equipment_id: equipmentId,
			task_type_id: match.id,
			title: entry.title,
			...(entry.description !== undefined && { description: entry.description }),
			...(entry.time_interval_days !== undefined && {
				time_interval_days: entry.time_interval_days
			}),
			...(entry.usage_interval !== undefined && { usage_interval: entry.usage_interval }),
			...(entry.priority !== undefined && { priority: entry.priority })
		});
	}

	return { tasks, skipped_unresolved_type_names, skipped_duplicate_task_type_ids };
}
