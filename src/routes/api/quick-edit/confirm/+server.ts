import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	equipmentRepository,
	taskRepository,
	maintenanceLogRepository
} from '$lib/repositories.js';
import { _pendingActions } from '../+server.js';
import type { Kysely } from 'kysely';
import type { Database } from '$lib/types/db';

interface ConfirmRequest {
	action_id: string;
	confirmed: boolean;
	updated_data?: any;
	user_feedback?: string;
}

interface ConfirmResponse {
	success: boolean;
	result?: any;
	message?: string;
	error?: string;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	console.log('Mech assist confirm request');

	try {
		const { action_id, confirmed, updated_data, user_feedback }: ConfirmRequest =
			await request.json();

		if (!action_id) {
			return json(
				{
					success: false,
					error: 'Action ID is required'
				},
				{ status: 400 }
			);
		}

		// Get the pending action
		const actionEntry = _pendingActions.get(action_id);

		if (!actionEntry) {
			return json(
				{
					success: false,
					error: 'Action not found or expired'
				},
				{ status: 404 }
			);
		}

		// Check if action has expired
		if (Date.now() > actionEntry.expires) {
			_pendingActions.delete(action_id);
			return json(
				{
					success: false,
					error: 'Action has expired'
				},
				{ status: 410 }
			);
		}

		const action = actionEntry.action;

		// Remove from pending actions
		_pendingActions.delete(action_id);

		if (!confirmed) {
			console.log('Action cancelled');
			return json({
				success: true,
				message: 'Action cancelled'
			});
		}

		// Update action data if user provided modifications
		if (updated_data) {
			console.log('Applying user modifications to action data');
			action.data = { ...action.data, ...updated_data };
		}

		// Log user feedback if provided
		if (user_feedback) {
			console.log('User feedback:', user_feedback);
			// TODO: Could potentially re-process user feedback with LLM to make further adjustments
		}

		// Execute the confirmed action
		let result;

		try {
			console.log('Executing action:', action.type, action.entity);

			switch (action.entity) {
				case 'equipment':
					result = await executeEquipmentAction(locals.db, action);
					break;
				case 'task':
					result = await executeTaskAction(locals.db, action);
					break;
				case 'maintenance_log':
					result = await executeMaintenanceLogAction(locals.db, action);
					break;
				default:
					throw new Error(`Unknown entity type: ${action.entity}`);
			}

			const successMessage = getSuccessMessage(action);
			console.log('Action completed:', successMessage);

			return json({
				success: true,
				result,
				message: successMessage
			} as ConfirmResponse);
		} catch (error) {
			console.error(
				'Action execution failed:',
				error instanceof Error ? error.message : 'Unknown error'
			);
			return json(
				{
					success: false,
					error: error instanceof Error ? error.message : 'Action execution failed'
				},
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error('Confirm API error:', error instanceof Error ? error.message : 'Unknown error');
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred'
			},
			{ status: 500 }
		);
	}
};

async function executeEquipmentAction(db: Kysely<Database>, action: any) {
	switch (action.type) {
		case 'create':
			return await equipmentRepository.create(db, action.data);
		case 'update':
			return await equipmentRepository.update(db, action.data.id, action.data.updates);
		case 'delete':
			return await equipmentRepository.delete(db, action.data.id);
		default:
			throw new Error(`Unknown equipment action: ${action.type}`);
	}
}

async function executeTaskAction(db: Kysely<Database>, action: any) {
	switch (action.type) {
		case 'create':
			return await taskRepository.create(db, action.data);
		case 'update':
			return await taskRepository.update(db, action.data.id, action.data.updates);
		case 'delete':
			return await taskRepository.delete(db, action.data.id);
		default:
			throw new Error(`Unknown task action: ${action.type}`);
	}
}

async function executeMaintenanceLogAction(db: Kysely<Database>, action: any) {
	switch (action.type) {
		case 'create':
			// Check if this is a task completion or standalone log
			if (action.data.task_id) {
				// This is a task completion - update task and create log
				return await completeTask(db, action.data);
			} else {
				// Standalone maintenance log
				return await maintenanceLogRepository.create(db, action.data);
			}
		default:
			throw new Error(`Unknown maintenance log action: ${action.type}`);
	}
}

async function completeTask(db: Kysely<Database>, data: any) {
	// Get the task to update
	const task = await taskRepository.getById(db, data.task_id);
	if (!task) {
		throw new Error(`Task with ID ${data.task_id} not found`);
	}

	// Get equipment for usage value updates
	const equipment = await equipmentRepository.getById(db, task.equipment_id);
	if (!equipment) {
		throw new Error(`Equipment with ID ${task.equipment_id} not found`);
	}

	// Create maintenance log
	const logData = {
		task_id: data.task_id,
		user_id: task.user_id,
		equipment_id: task.equipment_id,
		completed_date: data.completed_date,
		completed_usage_value: data.completed_usage_value,
		notes: data.notes,
		cost: data.cost,
		parts_used: data.parts_used ? JSON.stringify(data.parts_used) : undefined,
		service_provider: data.service_provider
	};

	const maintenanceLog = await maintenanceLogRepository.create(db, logData);

	// Calculate next due dates
	let nextDueDate: string | undefined;
	let nextDueUsageValue: number | undefined;

	if (task.time_interval_days) {
		const nextDate = new Date(data.completed_date);
		nextDate.setDate(nextDate.getDate() + task.time_interval_days);
		nextDueDate = nextDate.toISOString().split('T')[0];
	}

	if (task.usage_interval && data.completed_usage_value) {
		nextDueUsageValue = data.completed_usage_value + task.usage_interval;
	}

	// Update task with completion info and next due dates
	const taskUpdates = {
		last_completed_date: data.completed_date,
		last_completed_usage_value: data.completed_usage_value,
		next_due_date: nextDueDate,
		next_due_usage_value: nextDueUsageValue,
		status: 'pending' as const // Reset to pending for next occurrence
	};

	const updatedTask = await taskRepository.update(db, data.task_id, taskUpdates);

	// Update equipment usage value if provided
	if (data.completed_usage_value && data.completed_usage_value > equipment.current_usage_value) {
		await equipmentRepository.update(db, task.equipment_id, {
			current_usage_value: data.completed_usage_value
		});
	}

	return {
		maintenance_log: maintenanceLog,
		updated_task: updatedTask
	};
}

function getSuccessMessage(action: any): string {
	const entity = action.entity.replace('_', ' ');

	switch (action.type) {
		case 'create':
			return `${entity} created successfully`;
		case 'update':
			return `${entity} updated successfully`;
		case 'delete':
			return `${entity} deleted successfully`;
		default:
			return 'Action completed successfully';
	}
}
