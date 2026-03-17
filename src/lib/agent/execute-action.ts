import type { Kysely } from 'kysely';
import type { Database } from '$lib/types/db.js';
import {
	equipmentRepository,
	taskRepository,
	maintenanceLogRepository
} from '$lib/repositories.js';
import type { ActionResult } from './executor.js';

export async function executeConfirmedAction(
	db: Kysely<Database>,
	action: ActionResult
): Promise<unknown> {
	switch (action.entity) {
		case 'equipment':
			return executeEquipmentAction(db, action);
		case 'task':
			return executeTaskAction(db, action);
		case 'maintenance_log':
			return executeMaintenanceLogAction(db, action);
		default:
			throw new Error(`Unknown entity type: ${(action as ActionResult).entity}`);
	}
}

export function getSuccessMessage(action: ActionResult): string {
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

async function executeEquipmentAction(db: Kysely<Database>, action: ActionResult) {
	if (action.type === 'query' || !action.data) throw new Error('Invalid equipment action');
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

async function executeTaskAction(db: Kysely<Database>, action: ActionResult) {
	if (action.type === 'query' || !action.data) throw new Error('Invalid task action');
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

async function executeMaintenanceLogAction(db: Kysely<Database>, action: ActionResult) {
	if (action.type !== 'create' || !action.data) {
		throw new Error(`Unknown maintenance log action: ${action.type}`);
	}
	if (action.data.task_id) {
		return await completeTask(db, action.data);
	}
	return await maintenanceLogRepository.create(db, action.data);
}

async function completeTask(db: Kysely<Database>, data: any) {
	const task = await taskRepository.getById(db, data.task_id);
	if (!task) throw new Error(`Task with ID ${data.task_id} not found`);

	const equipment = await equipmentRepository.getById(db, task.equipment_id);
	if (!equipment) throw new Error(`Equipment with ID ${task.equipment_id} not found`);

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

	const taskUpdates = {
		last_completed_date: data.completed_date,
		last_completed_usage_value: data.completed_usage_value,
		next_due_date: nextDueDate,
		next_due_usage_value: nextDueUsageValue,
		status: 'pending' as const
	};

	const updatedTask = await taskRepository.update(db, data.task_id, taskUpdates);

	if (data.completed_usage_value && data.completed_usage_value > equipment.current_usage_value) {
		await equipmentRepository.update(db, task.equipment_id, {
			current_usage_value: data.completed_usage_value
		});
	}

	return { maintenance_log: maintenanceLog, updated_task: updatedTask };
}
