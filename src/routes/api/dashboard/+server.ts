import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { dashboardRepository } from '$lib/repositories.js';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const stats = await dashboardRepository.getStats(locals.db);
		return json(stats);
	} catch (error) {
		console.error('Error fetching dashboard stats:', error);
		return json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
	}
};
