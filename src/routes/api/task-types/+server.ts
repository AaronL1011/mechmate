import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { taskTypeRepository } from '$lib/repositories.js';

export const GET: RequestHandler = async ({ locals }) => {
  try {
    const taskTypes = await taskTypeRepository.getAll(locals.db);
    return json(taskTypes);
  } catch (error) {
    console.error('Error fetching task types:', error);
    return json({ error: 'Failed to fetch task types' }, { status: 500 });
  }
}; 