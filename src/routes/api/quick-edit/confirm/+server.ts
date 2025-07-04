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
}

interface ConfirmResponse {
	success: boolean;
	result?: any;
	message?: string;
	error?: string;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	console.log('=== Quick Edit Confirm Request Started ===');
	
	try {
		const { action_id, confirmed }: ConfirmRequest = await request.json();
		console.log('Confirm request payload:', { action_id, confirmed });

		if (!action_id) {
			console.error('No action_id provided');
			return json({ 
				success: false, 
				error: 'Action ID is required' 
			}, { status: 400 });
		}

		// Get the pending action
		console.log('Looking for pending action with ID:', action_id);
		console.log('Current pending actions:', Array.from(_pendingActions.keys()));
		const action = _pendingActions.get(action_id);
		
		if (!action) {
			console.error('Action not found in pending actions');
			return json({ 
				success: false, 
				error: 'Action not found or expired' 
			}, { status: 404 });
		}

		console.log('Found pending action:', action);

		// Remove from pending actions
		console.log('Removing action from pending actions');
		_pendingActions.delete(action_id);

		if (!confirmed) {
			console.log('Action was cancelled by user');
			return json({
				success: true,
				message: 'Action cancelled'
			});
		}

		console.log('Action confirmed, proceeding with execution');

		// Execute the confirmed action
		let result;
		
		try {
			console.log('Executing action for entity:', action.entity, 'type:', action.type);
			
			switch (action.entity) {
				case 'equipment':
					console.log('Executing equipment action...');
					result = await executeEquipmentAction(locals.db, action);
					break;
				case 'task':
					console.log('Executing task action...');
					result = await executeTaskAction(locals.db, action);
					break;
				case 'maintenance_log':
					console.log('Executing maintenance log action...');
					result = await executeMaintenanceLogAction(locals.db, action);
					break;
				default:
					throw new Error(`Unknown entity type: ${action.entity}`);
			}

			console.log('Action execution completed successfully:', result);
			const successMessage = getSuccessMessage(action);
			console.log('Success message:', successMessage);

			return json({
				success: true,
				result,
				message: successMessage
			});

		} catch (error) {
			console.error('=== Action Execution Error ===');
			console.error('Error details:', error);
			console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
			console.error('Action that failed:', action);
			return json({ 
				success: false, 
				error: error instanceof Error ? error.message : 'Action execution failed' 
			}, { status: 500 });
		}

	} catch (error) {
		console.error('=== Confirm API Error ===');
		console.error('Error details:', error);
		console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
		return json({ 
			success: false, 
			error: error instanceof Error ? error.message : 'Unknown error occurred' 
		}, { status: 500 });
	}
};

async function executeEquipmentAction(db: Kysely<Database>, action: any) {
	console.log('Executing equipment action:', action.type, 'with data:', action.data);
	
	switch (action.type) {
		case 'create':
			console.log('Creating equipment with data:', action.data);
			const createResult = await equipmentRepository.create(db, action.data);
			console.log('Equipment created:', createResult);
			return createResult;
		case 'update':
			console.log('Updating equipment ID:', action.data.id, 'with updates:', action.data.updates);
			const updateResult = await equipmentRepository.update(db, action.data.id, action.data.updates);
			console.log('Equipment updated:', updateResult);
			return updateResult;
		case 'delete':
			console.log('Deleting equipment ID:', action.data.id);
			const deleteResult = await equipmentRepository.delete(db, action.data.id);
			console.log('Equipment deleted:', deleteResult);
			return deleteResult;
		default:
			throw new Error(`Unknown equipment action: ${action.type}`);
	}
}

async function executeTaskAction(db: Kysely<Database>, action: any) {
	console.log('Executing task action:', action.type, 'with data:', action.data);
	
	switch (action.type) {
		case 'create':
			console.log('Creating task with data:', action.data);
			const createResult = await taskRepository.create(db, action.data);
			console.log('Task created:', createResult);
			return createResult;
		case 'update':
			console.log('Updating task ID:', action.data.id, 'with updates:', action.data.updates);
			const updateResult = await taskRepository.update(db, action.data.id, action.data.updates);
			console.log('Task updated:', updateResult);
			return updateResult;
		case 'delete':
			console.log('Deleting task ID:', action.data.id);
			const deleteResult = await taskRepository.delete(db, action.data.id);
			console.log('Task deleted:', deleteResult);
			return deleteResult;
		default:
			throw new Error(`Unknown task action: ${action.type}`);
	}
}

async function executeMaintenanceLogAction(db: Kysely<Database>, action: any) {
	console.log('Executing maintenance log action:', action.type, 'with data:', action.data);
	
	switch (action.type) {
		case 'create':
			// Check if this is a task completion or standalone log
			if (action.data.task_id) {
				console.log('Creating maintenance log as task completion for task ID:', action.data.task_id);
				// This is a task completion - update task and create log
				const result = await completeTask(db, action.data);
				console.log('Task completion result:', result);
				return result;
			} else {
				console.log('Creating standalone maintenance log');
				// Standalone maintenance log
				const result = await maintenanceLogRepository.create(db, action.data);
				console.log('Standalone maintenance log created:', result);
				return result;
			}
		default:
			throw new Error(`Unknown maintenance log action: ${action.type}`);
	}
}

async function completeTask(db: Kysely<Database>, data: any) {
	console.log('Completing task with data:', data);
	
	// Get the task to update
	console.log('Fetching task with ID:', data.task_id);
	const task = await taskRepository.getById(db, data.task_id);
	if (!task) {
		throw new Error(`Task with ID ${data.task_id} not found`);
	}
	console.log('Found task:', task);

	// Get equipment for usage value updates
	console.log('Fetching equipment with ID:', task.equipment_id);
	const equipment = await equipmentRepository.getById(db, task.equipment_id);
	console.log('Found equipment:', equipment);
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