import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { equipmentRepository, maintenanceLogRepository } from '$lib/repositories.js';

export const GET: RequestHandler = async ({ params, url, locals }) => {
	const id = Number(params.id);
	if (Number.isNaN(id)) {
		return json({ error: 'Invalid equipment ID', code: 'VALIDATION_ERROR' }, { status: 400 });
	}
	const equipment = await equipmentRepository.getById(locals.db, id);
	if (!equipment) {
		return json({ error: 'Equipment not found', code: 'NOT_FOUND' }, { status: 404 });
	}
	const startDate = url.searchParams.get('start_date') ?? undefined;
	const endDate = url.searchParams.get('end_date') ?? undefined;
	const summary = await maintenanceLogRepository.getCostSummaryByEquipment(
		locals.db,
		id,
		startDate,
		endDate
	);
	return json(summary);
};
