import type { DashboardStats, Equipment, TaskType, EquipmentType } from '$lib/types/db.js';

export interface AppShell {
	stats: DashboardStats | null;
	equipment: Equipment[];
	taskTypes: TaskType[];
	equipmentTypes: EquipmentType[];
}
