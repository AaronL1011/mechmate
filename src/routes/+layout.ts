import type { DashboardStats, Equipment, TaskType, EquipmentType } from '$lib/types/db.js';
import type { AppShell } from '$lib/types/appShell';

export type { AppShell };

const emptyShell: AppShell = {
	stats: null,
	equipment: [],
	taskTypes: [],
	equipmentTypes: []
};

function isEquipmentLabelPath(pathname: string): boolean {
	return /^\/equipment\/[^/]+\/label\/?$/.test(pathname);
}

export const load = async ({
	url,
	fetch
}: {
	url: URL;
	fetch: typeof globalThis.fetch;
}): Promise<{ shell: AppShell }> => {
	if (isEquipmentLabelPath(url.pathname)) {
		return { shell: emptyShell };
	}

	try {
		const [statsRes, equipmentRes, taskTypesRes, equipmentTypesRes] = await Promise.all([
			fetch('/api/dashboard'),
			fetch('/api/equipment'),
			fetch('/api/task-types'),
			fetch('/api/equipment-types')
		]);

		if (!statsRes.ok || !equipmentRes.ok || !taskTypesRes.ok || !equipmentTypesRes.ok) {
			throw new Error('Failed to load app shell');
		}

		const [stats, equipment, taskTypes, equipmentTypes] = await Promise.all([
			statsRes.json() as Promise<DashboardStats>,
			equipmentRes.json() as Promise<Equipment[]>,
			taskTypesRes.json() as Promise<TaskType[]>,
			equipmentTypesRes.json() as Promise<EquipmentType[]>
		]);

		return {
			shell: { stats, equipment, taskTypes, equipmentTypes }
		};
	} catch (err) {
		console.error('App shell load error:', err);
		return { shell: emptyShell };
	}
};
