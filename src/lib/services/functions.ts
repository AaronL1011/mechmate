import type { LLMFunction } from './llm.js';
import type { Kysely } from 'kysely';
import type { Database } from '../types/db.js';
import {
	equipmentRepository,
	taskRepository,
	maintenanceLogRepository,
	equipmentTypeRepository,
	taskTypeRepository
} from '../repositories.js';

export interface FunctionContext {
	db: Kysely<Database>;
}

export interface ActionResult {
	type: 'create' | 'update' | 'delete' | 'query';
	entity: 'equipment' | 'task' | 'maintenance_log';
	data?: any;
	result?: any;
	error?: string;
	confirmation_message?: string;
	requires_confirmation?: boolean;
}

// Equipment Functions
export const equipmentFunctions: LLMFunction[] = [
	{
		name: 'get_equipment_list',
		description: 'Get a list of all equipment to help with context and selection',
		parameters: {
			type: 'object',
			properties: {},
			required: []
		}
	},
	{
		name: 'get_equipment_types',
		description: 'Get a list of available equipment types',
		parameters: {
			type: 'object',
			properties: {},
			required: []
		}
	},
	{
		name: 'search_equipment',
		description: 'Search for equipment by name, make, model, or equipment type',
		parameters: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'Search query for equipment name, make, model, or equipment type'
				}
			},
			required: ['query']
		}
	},
	{
		name: 'create_equipment',
		description: 'Create new equipment entry',
		parameters: {
			type: 'object',
			properties: {
				name: {
					type: 'string',
					description: 'Name of the equipment'
				},
				equipment_type_id: {
					type: 'number',
					description: 'ID of the equipment type'
				},
				make: {
					type: 'string',
					description: 'Manufacturer or brand'
				},
				model: {
					type: 'string',
					description: 'Model name or number'
				},
				year: {
					type: 'number',
					description: 'Year of manufacture'
				},
				serial_number: {
					type: 'string',
					description: 'Serial number'
				},
				purchase_date: {
					type: 'string',
					description: 'Purchase date in YYYY-MM-DD format'
				},
				current_usage_value: {
					type: 'number',
					description: 'Current usage value (miles, hours, cycles, etc.)'
				},
				usage_unit: {
					type: 'string',
					description: 'Unit of usage measurement (miles, km, hours, cycles, etc.)'
				},
				metadata: {
					type: 'string',
					description: 'JSON string for flexible equipment-specific data'
				},
				tags: {
					type: 'string',
					description: 'JSON array of tags as string'
				}
			},
			required: ['name', 'equipment_type_id', 'current_usage_value', 'usage_unit']
		}
	},
	{
		name: 'update_equipment',
		description: 'Update existing equipment',
		parameters: {
			type: 'object',
			properties: {
				equipment_id: {
					type: 'number',
					description: 'ID of the equipment to update'
				},
				updates: {
					type: 'object',
					description: 'Fields to update',
					properties: {
						name: { type: 'string' },
						equipment_type_id: { type: 'number' },
						make: { type: 'string' },
						model: { type: 'string' },
						year: { type: 'number' },
						serial_number: { type: 'string' },
						purchase_date: { type: 'string' },
						current_usage_value: { type: 'number' },
						usage_unit: { type: 'string' },
						metadata: { type: 'string' },
						tags: { type: 'string' }
					}
				}
			},
			required: ['equipment_id', 'updates']
		}
	},
	{
		name: 'delete_equipment',
		description: 'Delete equipment and all associated tasks and logs',
		parameters: {
			type: 'object',
			properties: {
				equipment_id: {
					type: 'number',
					description: 'ID of the equipment to delete'
				}
			},
			required: ['equipment_id']
		}
	}
];

// Task Functions
export const taskFunctions: LLMFunction[] = [
	{
		name: 'get_task_types',
		description: 'Get a list of available task types',
		parameters: {
			type: 'object',
			properties: {},
			required: []
		}
	},
	{
		name: 'get_tasks',
		description: 'Get tasks, optionally filtered by equipment, status, or priority',
		parameters: {
			type: 'object',
			properties: {
				equipment_id: {
					type: 'number',
					description: 'Filter by equipment ID'
				},
				status: {
					type: 'string',
					enum: ['pending', 'completed', 'overdue'],
					description: 'Filter by task status'
				},
				priority: {
					type: 'string',
					enum: ['low', 'medium', 'high', 'critical'],
					description: 'Filter by priority'
				}
			},
			required: []
		}
	},
	{
		name: 'get_upcoming_tasks',
		description: 'Get tasks that are due within a specified number of days',
		parameters: {
			type: 'object',
			properties: {
				days: {
					type: 'number',
					description: 'Number of days to look ahead (default: 90)'
				}
			},
			required: []
		}
	},
	{
		name: 'create_task',
		description: 'Create a new maintenance task',
		parameters: {
			type: 'object',
			properties: {
				equipment_id: {
					type: 'number',
					description: 'ID of the equipment this task is for'
				},
				task_type_id: {
					type: 'number',
					description: 'ID of the task type'
				},
				title: {
					type: 'string',
					description: 'Title of the task'
				},
				description: {
					type: 'string',
					description: 'Detailed description of the task'
				},
				usage_interval: {
					type: 'number',
					description: 'Usage interval for recurring tasks (e.g., every 3000 miles)'
				},
				time_interval_days: {
					type: 'number',
					description: 'Time interval in days for recurring tasks (e.g., every 90 days)'
				},
				last_completed_usage_value: {
					type: 'number',
					description: 'Usage value when task was last completed'
				},
				last_completed_date: {
					type: 'string',
					description: 'Date when task was last completed in YYYY-MM-DD format'
				},
				next_due_usage_value: {
					type: 'number',
					description: 'Usage value when task is next due'
				},
				next_due_date: {
					type: 'string',
					description: 'Date when task is next due in YYYY-MM-DD format'
				},
				priority: {
					type: 'string',
					enum: ['low', 'medium', 'high', 'critical'],
					description: 'Task priority'
				},
				status: {
					type: 'string',
					enum: ['pending', 'completed', 'overdue'],
					description: 'Task status'
				}
			},
			required: ['equipment_id', 'task_type_id', 'title']
		}
	},
	{
		name: 'update_task',
		description: 'Update an existing task',
		parameters: {
			type: 'object',
			properties: {
				task_id: {
					type: 'number',
					description: 'ID of the task to update'
				},
				updates: {
					type: 'object',
					description: 'Fields to update',
					properties: {
						title: { type: 'string' },
						description: { type: 'string' },
						usage_interval: { type: 'number' },
						time_interval_days: { type: 'number' },
						last_completed_usage_value: { type: 'number' },
						last_completed_date: { type: 'string' },
						next_due_usage_value: { type: 'number' },
						next_due_date: { type: 'string' },
						priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
						status: { type: 'string', enum: ['pending', 'completed', 'overdue'] }
					}
				}
			},
			required: ['task_id', 'updates']
		}
	},
	{
		name: 'delete_task',
		description: 'Delete a task and all associated maintenance logs',
		parameters: {
			type: 'object',
			properties: {
				task_id: {
					type: 'number',
					description: 'ID of the task to delete'
				}
			},
			required: ['task_id']
		}
	}
];

// Maintenance Log Functions
export const maintenanceLogFunctions: LLMFunction[] = [
	{
		name: 'get_maintenance_logs',
		description: 'Get maintenance logs, optionally filtered by equipment or task',
		parameters: {
			type: 'object',
			properties: {
				equipment_id: {
					type: 'number',
					description: 'Filter by equipment ID'
				},
				task_id: {
					type: 'number',
					description: 'Filter by task ID'
				},
				date_range: {
					type: 'object',
					properties: {
						start_date: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
						end_date: { type: 'string', description: 'End date in YYYY-MM-DD format' }
					},
					description: 'Date range to filter logs'
				}
			},
			required: []
		}
	},
	{
		name: 'complete_task',
		description: 'Complete a task by creating a maintenance log entry',
		parameters: {
			type: 'object',
			properties: {
				task_id: {
					type: 'number',
					description: 'ID of the task being completed'
				},
				completed_date: {
					type: 'string',
					description: 'Date of completion in YYYY-MM-DD format'
				},
				completed_usage_value: {
					type: 'number',
					description: 'Usage value when task was completed (miles, hours, etc.)'
				},
				notes: {
					type: 'string',
					description: 'Notes about the maintenance performed'
				},
				cost: {
					type: 'number',
					description: 'Cost of the maintenance'
				},
				parts_used: {
					type: 'string',
					description: 'JSON array of parts used in the maintenance'
				},
				service_provider: {
					type: 'string',
					description: 'Who performed the maintenance (self, shop name, etc.)'
				}
			},
			required: ['task_id', 'completed_date']
		}
	},
	{
		name: 'create_maintenance_log',
		description: 'Create a standalone maintenance log entry',
		parameters: {
			type: 'object',
			properties: {
				task_id: {
					type: 'number',
					description: 'ID of the associated task'
				},
				equipment_id: {
					type: 'number',
					description: 'ID of the equipment'
				},
				completed_date: {
					type: 'string',
					description: 'Date of completion in YYYY-MM-DD format'
				},
				completed_usage_value: {
					type: 'number',
					description: 'Usage value when maintenance was performed'
				},
				notes: {
					type: 'string',
					description: 'Notes about the maintenance performed'
				},
				cost: {
					type: 'number',
					description: 'Cost of the maintenance'
				},
				parts_used: {
					type: 'string',
					description: 'JSON array of parts used in the maintenance'
				},
				service_provider: {
					type: 'string',
					description: 'Who performed the maintenance'
				}
			},
			required: ['task_id', 'equipment_id', 'completed_date']
		}
	}
];

// Combined function list
export const allFunctions: LLMFunction[] = [
	...equipmentFunctions,
	...taskFunctions,
	...maintenanceLogFunctions
];

// Function execution handlers
export class FunctionExecutor {
	constructor(private context: FunctionContext) {}

	async executeFunction(name: string, args: any): Promise<ActionResult> {
		try {
			switch (name) {
				// Equipment functions
				case 'get_equipment_list':
					return await this.getEquipmentList();
				case 'get_equipment_types':
					return await this.getEquipmentTypes();
				case 'search_equipment':
					return await this.searchEquipment(args.query);
				case 'create_equipment':
					return await this.createEquipment(args);
				case 'update_equipment':
					return await this.updateEquipment(args.equipment_id, args.updates);
				case 'delete_equipment':
					return await this.deleteEquipment(args.equipment_id);

				// Task functions
				case 'get_task_types':
					return await this.getTaskTypes();
				case 'get_tasks':
					return await this.getTasks();
				case 'get_upcoming_tasks':
					return await this.getUpcomingTasks(args.days);
				case 'create_task':
					return await this.createTask(args);
				case 'update_task':
					return await this.updateTask(args.task_id, args.updates);
				case 'delete_task':
					return await this.deleteTask(args.task_id);

				// Maintenance log functions
				case 'get_maintenance_logs':
					return await this.getMaintenanceLogs();
				case 'complete_task':
					return await this.completeTask(args);
				case 'create_maintenance_log':
					return await this.createMaintenanceLog(args);

				default:
					throw new Error(`Unknown function: ${name}`);
			}
		} catch (error) {
			return {
				type: 'query',
				entity: 'equipment',
				error: error instanceof Error ? error.message : 'Unknown error',
				requires_confirmation: false
			};
		}
	}

	// Equipment function implementations
	private async getEquipmentList(): Promise<ActionResult> {
		const equipment = await equipmentRepository.getAll(this.context.db);
		return {
			type: 'query',
			entity: 'equipment',
			result: equipment,
			requires_confirmation: false
		};
	}

	private async getEquipmentTypes(): Promise<ActionResult> {
		const types = await equipmentTypeRepository.getAll(this.context.db);
		return {
			type: 'query',
			entity: 'equipment',
			result: types,
			requires_confirmation: false
		};
	}

	private async searchEquipment(query: string): Promise<ActionResult> {
		const equipment = await equipmentRepository.getAll(this.context.db);
		const filtered = equipment.filter(
			(eq) =>
				eq.name.toLowerCase().includes(query.toLowerCase()) ||
				eq.make?.toLowerCase().includes(query.toLowerCase()) ||
				eq.model?.toLowerCase().includes(query.toLowerCase())
		);
		return {
			type: 'query',
			entity: 'equipment',
			result: filtered,
			requires_confirmation: false
		};
	}

	private async createEquipment(data: any): Promise<ActionResult> {
		return {
			type: 'create',
			entity: 'equipment',
			data,
			confirmation_message: `Create ${data.name} (${data.make} ${data.model})?`,
			requires_confirmation: true
		};
	}

	private async updateEquipment(id: number, updates: any): Promise<ActionResult> {
		const equipment = await equipmentRepository.getById(this.context.db, id);
		if (!equipment) {
			throw new Error(`Equipment with ID ${id} not found`);
		}
		return {
			type: 'update',
			entity: 'equipment',
			data: { id, updates },
			confirmation_message: `Update ${equipment.name} with the specified changes?`,
			requires_confirmation: true
		};
	}

	private async deleteEquipment(id: number): Promise<ActionResult> {
		const equipment = await equipmentRepository.getById(this.context.db, id);
		if (!equipment) {
			throw new Error(`Equipment with ID ${id} not found`);
		}
		return {
			type: 'delete',
			entity: 'equipment',
			data: { id },
			confirmation_message: `Delete ${equipment.name}? This will also delete all associated tasks and maintenance logs.`,
			requires_confirmation: true
		};
	}

	// Task function implementations
	private async getTaskTypes(): Promise<ActionResult> {
		const types = await taskTypeRepository.getAll(this.context.db);
		return {
			type: 'query',
			entity: 'task',
			result: types,
			requires_confirmation: false
		};
	}

	private async getTasks(): Promise<ActionResult> {
		const tasks = await taskRepository.getAll(this.context.db);
		// Apply filters if needed
		return {
			type: 'query',
			entity: 'task',
			result: tasks,
			requires_confirmation: false
		};
	}

	private async getUpcomingTasks(days?: number): Promise<ActionResult> {
		const tasks = await taskRepository.getUpcoming(this.context.db, days);
		return {
			type: 'query',
			entity: 'task',
			result: tasks,
			requires_confirmation: false
		};
	}

	private async createTask(data: any): Promise<ActionResult> {
		const equipment = await equipmentRepository.getById(this.context.db, data.equipment_id);
		const taskType = await taskTypeRepository.getById(this.context.db, data.task_type_id);

		if (!equipment) throw new Error(`Equipment with ID ${data.equipment_id} not found`);
		if (!taskType) throw new Error(`Task type with ID ${data.task_type_id} not found`);

		return {
			type: 'create',
			entity: 'task',
			data,
			confirmation_message: `Create task "${data.title}" for ${equipment.name}?`,
			requires_confirmation: true
		};
	}

	private async updateTask(id: number, updates: any): Promise<ActionResult> {
		const task = await taskRepository.getById(this.context.db, id);
		if (!task) {
			throw new Error(`Task with ID ${id} not found`);
		}
		return {
			type: 'update',
			entity: 'task',
			data: { id, updates },
			confirmation_message: `Update task "${task.title}" with the specified changes?`,
			requires_confirmation: true
		};
	}

	private async deleteTask(id: number): Promise<ActionResult> {
		const task = await taskRepository.getById(this.context.db, id);
		if (!task) {
			throw new Error(`Task with ID ${id} not found`);
		}
		return {
			type: 'delete',
			entity: 'task',
			data: { id },
			confirmation_message: `Delete task "${task.title}"? This will also delete all associated maintenance logs.`,
			requires_confirmation: true
		};
	}

	// Maintenance log function implementations
	private async getMaintenanceLogs(): Promise<ActionResult> {
		const logs = await maintenanceLogRepository.getAll(this.context.db);
		return {
			type: 'query',
			entity: 'maintenance_log',
			result: logs,
			requires_confirmation: false
		};
	}

	private async completeTask(data: any): Promise<ActionResult> {
		const task = await taskRepository.getById(this.context.db, data.task_id);
		if (!task) {
			throw new Error(`Task with ID ${data.task_id} not found`);
		}
		return {
			type: 'create',
			entity: 'maintenance_log',
			data,
			confirmation_message: `Mark task "${task.title}" as completed on ${data.completed_date}?`,
			requires_confirmation: true
		};
	}

	private async createMaintenanceLog(data: any): Promise<ActionResult> {
		const task = await taskRepository.getById(this.context.db, data.task_id);
		const equipment = await equipmentRepository.getById(this.context.db, data.equipment_id);

		if (!task) throw new Error(`Task with ID ${data.task_id} not found`);
		if (!equipment) throw new Error(`Equipment with ID ${data.equipment_id} not found`);

		return {
			type: 'create',
			entity: 'maintenance_log',
			data,
			confirmation_message: `Create maintenance log for ${equipment.name} on ${data.completed_date}?`,
			requires_confirmation: true
		};
	}
}
