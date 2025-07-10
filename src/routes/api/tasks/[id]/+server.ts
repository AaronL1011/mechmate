import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { taskRepository } from '$lib/repositories.js';
import type { UpdateTaskRequest } from '$lib/types/db.js';

export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		if (!params.id) {
			return json({ error: 'Task ID is required' }, { status: 400 });
		}

		const id = parseInt(params.id);
		if (isNaN(id)) {
			return json({ error: 'Invalid task ID' }, { status: 400 });
		}

		const task = await taskRepository.getById(locals.db, id);
		if (!task) {
			return json({ error: 'Task not found' }, { status: 404 });
		}

		return json(task);
	} catch (error) {
		console.error('Error fetching task:', error);
		return json({ error: 'Failed to fetch task' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	try {
		if (!params.id) {
			return json({ error: 'Task ID is required' }, { status: 400 });
		}

		const id = parseInt(params.id);
		if (isNaN(id)) {
			return json({ error: 'Invalid task ID' }, { status: 400 });
		}

		const body = (await request.json()) as UpdateTaskRequest;

		// Check if task exists
		const existing = await taskRepository.getById(locals.db, id);
		if (!existing) {
			return json({ error: 'Task not found' }, { status: 404 });
		}

		// Basic validation
		if (
			body.usage_interval !== null &&
			body.usage_interval !== undefined &&
			body.usage_interval <= 0
		) {
			return json({ error: 'Usage interval must be positive' }, { status: 400 });
		}

		if (
			body.time_interval_days !== null &&
			body.time_interval_days !== undefined &&
			body.time_interval_days <= 0
		) {
			return json({ error: 'Time interval must be positive' }, { status: 400 });
		}

		const task = await taskRepository.update(locals.db, id, body);
		return json(task);
	} catch (error) {
		console.error('Error updating task:', error);
		return json({ error: 'Failed to update task' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		if (!params.id) {
			return json({ error: 'Task ID is required' }, { status: 400 });
		}

		const id = parseInt(params.id);
		if (isNaN(id)) {
			return json({ error: 'Invalid task ID' }, { status: 400 });
		}

		const success = await taskRepository.delete(locals.db, id);
		if (!success) {
			return json({ error: 'Task not found' }, { status: 404 });
		}

		return json({ message: 'Task deleted successfully' });
	} catch (error) {
		console.error('Error deleting task:', error);
		return json({ error: 'Failed to delete task' }, { status: 500 });
	}
};
