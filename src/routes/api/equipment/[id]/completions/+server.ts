import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { maintenanceLogRepository } from '$lib/repositories.js';

export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const equipmentId = parseInt(params.id);

		if (isNaN(equipmentId)) {
			return json({ error: 'Invalid equipment ID' }, { status: 400 });
		}

		// Fetch maintenance logs with task titles for the equipment
		const completions = await maintenanceLogRepository.getByEquipmentId(locals.db, equipmentId);

		// Parse parts_used JSON strings to arrays
		const parsedCompletions = completions.map((completion: any) => ({
			...completion,
			parts_used: completion.parts_used ? JSON.parse(completion.parts_used) : undefined
		}));

		return json(parsedCompletions);
	} catch (error) {
		console.error('Error fetching equipment completions:', error);
		return json({ error: 'Failed to fetch maintenance history' }, { status: 500 });
	}
};
