import type {
	DashboardStats,
	Task,
	Equipment,
	TaskType,
	EquipmentType,
	GlobalSettingsValues,
	ProactiveSuggestion
} from '$lib/types/db.js';

export interface DashboardLoadData {
	stats: DashboardStats | null;
	upcomingTasks: Task[];
	equipment: Equipment[];
	taskTypes: TaskType[];
	equipmentTypes: EquipmentType[];
	dueSoonTasks: (Task & { equipment_name?: string })[];
	proactiveSuggestions: ProactiveSuggestion[];
	settings: GlobalSettingsValues;
	error?: string;
}

export const load = async ({
	fetch
}: {
	fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}): Promise<DashboardLoadData> => {
	try {
		const [
			statsRes,
			tasksRes,
			equipmentRes,
			taskTypesRes,
			equipmentTypesRes,
			dueSoonRes,
			suggestionsRes,
			settingsRes
		] = await Promise.all([
			fetch('/api/dashboard'),
			fetch('/api/tasks?type=upcoming'),
			fetch('/api/equipment'),
			fetch('/api/task-types'),
			fetch('/api/equipment-types'),
			fetch('/api/dashboard/due-soon?days=7'),
			fetch('/api/agent/suggestions'),
			fetch('/api/settings')
		]);

		if (
			!statsRes.ok ||
			!tasksRes.ok ||
			!equipmentRes.ok ||
			!taskTypesRes.ok ||
			!equipmentTypesRes.ok ||
			!settingsRes.ok
		) {
			throw new Error('Failed to load dashboard data');
		}

		const [
			stats,
			upcomingTasks,
			equipment,
			taskTypes,
			equipmentTypes,
			settings
		] = await Promise.all([
			statsRes.json() as Promise<DashboardStats>,
			tasksRes.json() as Promise<Task[]>,
			equipmentRes.json() as Promise<Equipment[]>,
			taskTypesRes.json() as Promise<TaskType[]>,
			equipmentTypesRes.json() as Promise<EquipmentType[]>,
			settingsRes.json() as Promise<GlobalSettingsValues>
		]);

		const dueSoonTasks = dueSoonRes.ok
			? (await dueSoonRes.json()) as (Task & { equipment_name?: string })[]
			: [];
		const proactiveSuggestions = suggestionsRes.ok
			? (await suggestionsRes.json()) as ProactiveSuggestion[]
			: [];

		return {
			stats,
			upcomingTasks,
			equipment,
			taskTypes,
			equipmentTypes,
			dueSoonTasks,
			proactiveSuggestions,
			settings
		};
	} catch (err) {
		console.error('Dashboard load error:', err);
		return {
			stats: null,
			upcomingTasks: [],
			equipment: [],
			taskTypes: [],
			equipmentTypes: [],
			dueSoonTasks: [],
			proactiveSuggestions: [],
			settings: {
				upcoming_task_range_days: 90,
				preferred_measurement_system: 'metric',
				assistant_tone: 'professional'
			},
			error: 'Failed to load dashboard data'
		};
	}
};
