import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { taskRepository } from '$lib/repositories.js';

export const GET: RequestHandler = async ({ url, locals }) => {
	const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') ?? '7', 10) || 7));
	const tasks = await taskRepository.getDueSoon(locals.db, days);
	return json(tasks);
};
