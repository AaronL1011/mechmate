import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import {
	taskRepository,
	maintenanceLogRepository,
	equipmentRepository
} from '$lib/repositories.js';
import type { CompleteTaskRequest } from '$lib/types/db.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = (await request.json()) as CompleteTaskRequest;

		// Basic validation
		if (!body.task_id || !body.completed_date) {
			return json({ error: 'Task ID and completion date are required' }, { status: 400 });
		}

		// Get the task
		const task = await taskRepository.getById(locals.db, body.task_id);
		if (!task) {
			return json({ error: 'Task not found' }, { status: 404 });
		}

		// Get the equipment
		const equipment = await equipmentRepository.getById(locals.db, task.equipment_id);
		if (!equipment) {
			return json({ error: 'Equipment not found' }, { status: 404 });
		}

		// Create maintenance log
		const maintenanceLog = await maintenanceLogRepository.create(locals.db, {
			task_id: body.task_id,
			equipment_id: task.equipment_id,
			completed_date: body.completed_date,
			completed_usage_value: body.completed_usage_value,
			notes: body.notes,
			cost: body.cost,
			parts_used: body.parts_used ? JSON.stringify(body.parts_used) : undefined,
			service_provider: body.service_provider
		});

		// Update task with completion info
		const updatedTask = await taskRepository.update(locals.db, body.task_id, {
			status: 'completed',
			last_completed_date: body.completed_date,
			last_completed_usage_value: body.completed_usage_value
		});

		// Calculate next due date/usage
		let nextDueDate: string | undefined;
		let nextDueUsageValue: number | undefined;

		if (task.time_interval_days) {
			// Time-based scheduling
			const completedDate = new Date(body.completed_date);
			const nextDate = new Date(completedDate);
			nextDate.setDate(nextDate.getDate() + task.time_interval_days);
			nextDueDate = nextDate.toISOString().split('T')[0];
		}

		if (task.usage_interval && body.completed_usage_value) {
			// Usage-based scheduling
			nextDueUsageValue = body.completed_usage_value + task.usage_interval;
		}

		// Update task with next due information
		if (nextDueDate || nextDueUsageValue) {
			await taskRepository.update(locals.db, body.task_id, {
				status: 'pending',
				next_due_date: nextDueDate,
				next_due_usage_value: nextDueUsageValue
			});
		}

		// Update equipment current usage if provided
		if (body.completed_usage_value !== undefined) {
			await equipmentRepository.update(locals.db, task.equipment_id, {
				current_usage_value: body.completed_usage_value
			});
		}

		return json({
			message: 'Task completed successfully',
			maintenance_log: maintenanceLog,
			updated_task: updatedTask
		});
	} catch (error) {
		console.error('Error completing task:', error);
		return json({ error: 'Failed to complete task' }, { status: 500 });
	}
};
