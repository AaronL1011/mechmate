import type {
	DashboardStats,
	Task,
	Equipment,
	TaskType,
	EquipmentType,
	GlobalSettingsValues,
	ProactiveSuggestion
} from '$lib/types/db.js';
import type { AppShell } from '$lib/types/appShell';

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
	parent,
	fetch
}: {
	parent: () => Promise<{ shell: AppShell }>;
	fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}): Promise<DashboardLoadData> => {
	const { shell } = await parent();

	try {
		const [tasksRes, dueSoonRes, suggestionsRes, settingsRes] = await Promise.all([
			fetch('/api/tasks?type=upcoming'),
			fetch('/api/dashboard/due-soon?days=7'),
			fetch('/api/agent/suggestions'),
			fetch('/api/settings')
		]);

		if (!tasksRes.ok || !settingsRes.ok) {
			throw new Error('Failed to load dashboard data');
		}

		const [upcomingTasks, settings] = await Promise.all([
			tasksRes.json() as Promise<Task[]>,
			settingsRes.json() as Promise<GlobalSettingsValues>
		]);

		const dueSoonTasks = dueSoonRes.ok
			? (await dueSoonRes.json()) as (Task & { equipment_name?: string })[]
			: [];
		const proactiveSuggestions = suggestionsRes.ok
			? (await suggestionsRes.json()) as ProactiveSuggestion[]
			: [];

		return {
			stats: shell.stats,
			equipment: shell.equipment,
			taskTypes: shell.taskTypes,
			equipmentTypes: shell.equipmentTypes,
			upcomingTasks,
			dueSoonTasks,
			proactiveSuggestions,
			settings
		};
	} catch (err) {
		console.error('Dashboard load error:', err);
		return {
			stats: shell.stats,
			equipment: shell.equipment,
			taskTypes: shell.taskTypes,
			equipmentTypes: shell.equipmentTypes,
			upcomingTasks: [],
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
