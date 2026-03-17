import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { taskRepository } from '$lib/repositories.js';
import type { CreateTaskRequest } from '$lib/types/db.js';

interface BulkTaskRequest {
	equipment_ids: number[];
	task_type_id: number;
	title: string;
	description?: string;
	usage_interval?: number;
	time_interval_days?: number;
	priority?: 'low' | 'medium' | 'high' | 'critical';
}

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = (await request.json()) as BulkTaskRequest;
		const { equipment_ids, task_type_id, title, description, usage_interval, time_interval_days, priority } =
			body;

		if (!equipment_ids?.length || !task_type_id || !title?.trim()) {
			return json(
				{
					error: 'equipment_ids, task_type_id, and title are required',
					code: 'VALIDATION_ERROR'
				},
				{ status: 400 }
			);
		}

		const created: { id: number; equipment_id: number }[] = [];
		for (const equipment_id of equipment_ids) {
			const taskData: CreateTaskRequest = {
				equipment_id,
				task_type_id,
				title: title.trim(),
				description,
				usage_interval,
				time_interval_days,
				priority
			};
			const task = await taskRepository.create(locals.db, taskData);
			created.push({ id: task.id, equipment_id });
		}

		return json({ created, count: created.length }, { status: 201 });
	} catch (error) {
		console.error('Bulk task create error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to create tasks',
				code: 'INTERNAL_ERROR'
			},
			{ status: 500 }
		);
	}
};
