import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/utils/db.js';
import { 
	equipmentRepository, 
	taskRepository, 
	maintenanceLogRepository 
} from '$lib/repositories.js';
import { pendingActions } from '../+server.js';

interface ConfirmRequest {
	action_id: string;
	confirmed: boolean;
}

interface ConfirmResponse {
	success: boolean;
	result?: any;
	message?: string;
	error?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { action_id, confirmed }: ConfirmRequest = await request.json();

		if (!action_id) {
			return json({ 
				success: false, 
				error: 'Action ID is required' 
			}, { status: 400 });
		}

		// Get the pending action
		const action = pendingActions.get(action_id);
		if (!action) {
			return json({ 
				success: false, 
				error: 'Action not found or expired' 
			}, { status: 404 });
		}

		// Remove from pending actions
		pendingActions.delete(action_id);

		if (!confirmed) {
			return json({
				success: true,
				message: 'Action cancelled'
			});
		}

		// Execute the confirmed action
		let result;
		
		try {
			switch (action.entity) {
				case 'equipment':
					result = await executeEquipmentAction(action);
					break;
				case 'task':
					result = await executeTaskAction(action);
					break;
				case 'maintenance_log':
					result = await executeMaintenanceLogAction(action);
					break;
				default:
					throw new Error(`Unknown entity type: ${action.entity}`);
			}

			return json({
				success: true,
				result,
				message: getSuccessMessage(action)
			});

		} catch (error) {
			console.error('Action execution error:', error);
			return json({ 
				success: false, 
				error: error instanceof Error ? error.message : 'Action execution failed' 
			}, { status: 500 });
		}

	} catch (error) {
		console.error('Confirm API error:', error);
		return json({ 
			success: false, 
			error: error instanceof Error ? error.message : 'Unknown error occurred' 
		}, { status: 500 });
	}
};

async function executeEquipmentAction(action: any) {
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

async function executeTaskAction(action: any) {
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

async function executeMaintenanceLogAction(action: any) {
	switch (action.type) {
		case 'create':
			// Check if this is a task completion or standalone log
			if (action.data.task_id) {
				// This is a task completion - update task and create log
				const result = await completeTask(action.data);
				return result;
			} else {
				// Standalone maintenance log
				return await maintenanceLogRepository.create(db, action.data);
			}
		default:
			throw new Error(`Unknown maintenance log action: ${action.type}`);
	}
}

async function completeTask(data: any) {
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