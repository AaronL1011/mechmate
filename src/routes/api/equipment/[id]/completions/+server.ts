import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { maintenanceLogRepository } from '$lib/repositories.js';
import { normalizePartsUsed } from '$lib/utils/parts.js';

export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const equipmentId = parseInt(params.id);

		if (isNaN(equipmentId)) {
			return json({ error: 'Invalid equipment ID' }, { status: 400 });
		}

		// Fetch maintenance logs with task titles for the equipment
		const completions = await maintenanceLogRepository.getByEquipmentId(locals.db, equipmentId);

		const parsedCompletions = completions.map((completion: { parts_used?: string | null; [k: string]: unknown }) => {
			const raw = completion.parts_used;
			const parts =
				raw != null && String(raw).length > 0 ? normalizePartsUsed(raw) : [];
			return {
				...completion,
				parts_used: parts.length > 0 ? parts : undefined
			};
		});

		return json(parsedCompletions);
	} catch (error) {
		console.error('Error fetching equipment completions:', error);
		return json({ error: 'Failed to fetch maintenance history' }, { status: 500 });
	}
};
