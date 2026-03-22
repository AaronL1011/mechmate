import type { LLMFunction } from './llm.js';
import type { Kysely } from 'kysely';
import type { Database } from '../types/db.js';
import {
	equipmentRepository,
	equipmentResourceRepository,
	taskRepository,
	maintenanceLogRepository,
	mergeMaintenanceLogNotesForAppend,
	equipmentTypeRepository,
	taskTypeRepository,
	globalSettingsRepository
} from '../repositories.js';
import { toEquipmentResourceClient } from '../equipment-resource-serialize.js';
import { runProactiveAgent } from '../agent/proactive.js';
import { buildBootstrapTasksForEquipment } from '../agent/bootstrap-schedule-templates.js';
import { enrichBootstrapTasksWithLlm } from '../agent/bootstrap-task-copy-enrichment.js';
import { getAssistantToneContext } from '../agent/prompts.js';
import type {
	GlobalSettingsValues,
	MaintenanceLogsQueryFilter,
	UpdateMaintenanceLogRequest
} from '../types/db.js';

export interface FunctionContext {
	db: Kysely<Database>;
}

export interface ActionResult {
	type: 'create' | 'update' | 'delete' | 'query';
	entity: 'equipment' | 'task' | 'task_batch' | 'maintenance_log';
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
	},
	{
		name: 'list_equipment_resources',
		description:
			'List uploaded documents (manuals, invoices, etc.) for one equipment item, including short text previews when extraction succeeded.',
		parameters: {
			type: 'object',
			properties: {
				equipment_id: {
					type: 'number',
					description: 'Equipment ID'
				}
			},
			required: ['equipment_id']
		}
	},
	{
		name: 'get_equipment_resource_excerpt',
		description:
			'Read a bounded excerpt of extracted plain text from one equipment resource (by resource id). Use after list_equipment_resources to ground answers in manuals. If extraction failed or is pending, the result explains why.',
		parameters: {
			type: 'object',
			properties: {
				resource_id: {
					type: 'number',
					description: 'ID of the resource row from list_equipment_resources'
				},
				equipment_id: {
					type: 'number',
					description:
						'Optional: verify the resource belongs to this equipment (recommended when known)'
				},
				start_char: {
					type: 'number',
					description: 'Character offset into extracted text (default 0)'
				},
				max_chars: {
					type: 'number',
					description: 'Maximum characters to return (default 8000, hard cap 16000)'
				}
			},
			required: ['resource_id']
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
	},
	{
		name: 'propose_bootstrap_service_schedule',
		description:
			'Propose a starter set of maintenance tasks for one equipment item based on its equipment type. Skips task types already on that equipment and types missing from the database. The user must confirm in the UI before tasks are created. Use after identifying equipment_id (e.g. via get_equipment_list or search_equipment).',
		parameters: {
			type: 'object',
			properties: {
				equipment_id: {
					type: 'number',
					description: 'ID of the equipment to bootstrap tasks for'
				}
			},
			required: ['equipment_id']
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
				},
				limit: {
					type: 'number',
					description:
						'Maximum number of logs to return (newest first). Defaults to 100; capped at 500.'
				}
			},
			required: []
		}
	},
	{
		name: 'update_maintenance_log',
		description:
			'Update an existing maintenance log (notes, cost, parts used, or service provider only). Does not change completion date, task, or equipment.',
		parameters: {
			type: 'object',
			properties: {
				maintenance_log_id: {
					type: 'number',
					description: 'ID of the maintenance log to update'
				},
				updates: {
					type: 'object',
					description: 'Fields to update (at least one required)',
					properties: {
						notes: { type: 'string', description: 'Notes (replaces existing notes)' },
						cost: { type: 'number', description: 'Cost of the maintenance' },
						parts_used: {
							type: 'string',
							description: 'JSON array string of parts used in the maintenance'
						},
						service_provider: { type: 'string', description: 'Who performed the maintenance' }
					}
				}
			},
			required: ['maintenance_log_id', 'updates']
		}
	},
	{
		name: 'append_maintenance_log_notes',
		description:
			'Append text to an existing maintenance log notes field with an automatic timestamp. Prefer this when the user wants to add commentary without replacing existing notes.',
		parameters: {
			type: 'object',
			properties: {
				maintenance_log_id: {
					type: 'number',
					description: 'ID of the maintenance log'
				},
				additional_notes: {
					type: 'string',
					description: 'Text to append to the log notes'
				}
			},
			required: ['maintenance_log_id', 'additional_notes']
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

export const suggestionsFunctions: LLMFunction[] = [
	{
		name: 'generate_suggestions',
		description:
			'Run the proactive maintenance analysis and generate a fresh set of Mech suggestions visible on the dashboard. Use when the user asks to refresh or generate suggestions.',
		parameters: {
			type: 'object',
			properties: {},
			required: []
		}
	}
];

// Combined function list
export const allFunctions: LLMFunction[] = [
	...equipmentFunctions,
	...taskFunctions,
	...maintenanceLogFunctions,
	...suggestionsFunctions
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
				case 'list_equipment_resources':
					return await this.listEquipmentResources(args.equipment_id);
				case 'get_equipment_resource_excerpt':
					return await this.getEquipmentResourceExcerpt(args);

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
				case 'propose_bootstrap_service_schedule':
					return await this.proposeBootstrapServiceSchedule(args.equipment_id);

				// Maintenance log functions
				case 'get_maintenance_logs':
					return await this.getMaintenanceLogs(args);
				case 'generate_suggestions':
					return await this.generateSuggestions();
				case 'complete_task':
					return await this.completeTask(args);
				case 'create_maintenance_log':
					return await this.createMaintenanceLog(args);
				case 'update_maintenance_log':
					return await this.updateMaintenanceLog(args.maintenance_log_id, args.updates);
				case 'append_maintenance_log_notes':
					return await this.appendMaintenanceLogNotes(
						args.maintenance_log_id,
						args.additional_notes
					);

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

	private async listEquipmentResources(equipmentId: number): Promise<ActionResult> {
		const equipment = await equipmentRepository.getById(this.context.db, equipmentId);
		if (!equipment) {
			throw new Error(`Equipment with ID ${equipmentId} not found`);
		}
		const rows = await equipmentResourceRepository.getByEquipmentId(this.context.db, equipmentId);
		return {
			type: 'query',
			entity: 'equipment',
			result: {
				equipment_id: equipmentId,
				equipment_name: equipment.name,
				resources: rows.map(toEquipmentResourceClient)
			},
			requires_confirmation: false
		};
	}

	private async getEquipmentResourceExcerpt(args: {
		resource_id: number;
		equipment_id?: number;
		start_char?: number;
		max_chars?: number;
	}): Promise<ActionResult> {
		const row = await equipmentResourceRepository.getById(this.context.db, args.resource_id);
		if (!row) {
			throw new Error(`Resource with ID ${args.resource_id} not found`);
		}
		if (args.equipment_id !== undefined && row.equipment_id !== args.equipment_id) {
			throw new Error('Resource does not belong to the specified equipment');
		}
		const start = Math.max(0, Math.floor(args.start_char ?? 0));
		const requested = Math.floor(args.max_chars ?? 8000);
		const max = Math.min(16000, Math.max(256, requested));
		if (row.extraction_status !== 'ok' || !row.extracted_text) {
			return {
				type: 'query',
				entity: 'equipment',
				result: {
					resource_id: row.id,
					equipment_id: row.equipment_id,
					original_filename: row.original_filename,
					resource_kind: row.resource_kind,
					extraction_status: row.extraction_status,
					excerpt: null,
					message:
						row.extraction_status === 'pending'
							? 'Text extraction is still pending or was not run.'
							: row.extraction_status === 'skipped'
								? 'No extractable text for this file type or content (e.g. scanned PDF without OCR).'
								: row.extraction_status === 'failed'
									? 'Text extraction failed for this file.'
									: 'No extracted text available.'
				},
				requires_confirmation: false
			};
		}
		const full = row.extracted_text;
		const slice = full.slice(start, start + max);
		return {
			type: 'query',
			entity: 'equipment',
			result: {
				resource_id: row.id,
				equipment_id: row.equipment_id,
				original_filename: row.original_filename,
				resource_kind: row.resource_kind,
				start_char: start,
				max_chars: max,
				total_extracted_length: full.length,
				text_truncated_in_storage: Number(row.text_truncated) === 1,
				excerpt: slice,
				has_more: start + slice.length < full.length
			},
			requires_confirmation: false
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

	private async proposeBootstrapServiceSchedule(equipmentId: number): Promise<ActionResult> {
		if (equipmentId == null || Number.isNaN(Number(equipmentId))) {
			throw new Error('equipment_id is required');
		}
		const equipment = await equipmentRepository.getById(this.context.db, equipmentId);
		if (!equipment) {
			throw new Error(`Equipment with ID ${equipmentId} not found`);
		}

		const [taskTypes, existingTasks] = await Promise.all([
			taskTypeRepository.getAll(this.context.db),
			taskRepository.getByEquipmentId(this.context.db, equipmentId)
		]);

		const bootstrapBuilt = buildBootstrapTasksForEquipment(
			equipmentId,
			equipment.equipment_type_id,
			taskTypes,
			existingTasks
		);
		const { skipped_unresolved_type_names, skipped_duplicate_task_type_ids } = bootstrapBuilt;
		let tasks = bootstrapBuilt.tasks;

		const existing_task_type_ids = [...new Set(existingTasks.map((t) => t.task_type_id))];

		if (tasks.length === 0) {
			return {
				type: 'query',
				entity: 'task',
				result: {
					nothing_to_create: true,
					equipment_id: equipmentId,
					equipment_name: equipment.name,
					skipped_unresolved_type_names,
					skipped_duplicate_task_type_ids,
					existing_task_type_ids
				},
				requires_confirmation: false
			};
		}

		const equipmentTypeRow = await equipmentTypeRepository.getById(
			this.context.db,
			equipment.equipment_type_id
		);
		const equipmentTypeName = equipmentTypeRow?.name ?? 'other';
		const taskTypeById = new Map(taskTypes.map((tt) => [tt.id, tt]));
		tasks = await enrichBootstrapTasksWithLlm(equipment, equipmentTypeName, tasks, taskTypeById);

		return {
			type: 'create',
			entity: 'task_batch',
			data: {
				equipment_id: equipmentId,
				equipment_name: equipment.name,
				tasks,
				skipped_unresolved_type_names,
				skipped_duplicate_task_type_ids
			},
			confirmation_message: `Create ${tasks.length} maintenance task${tasks.length === 1 ? '' : 's'} for "${equipment.name}"?`,
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
	private async getMaintenanceLogs(args: Record<string, unknown> = {}): Promise<ActionResult> {
		const equipmentId = args.equipment_id as number | undefined;
		const taskId = args.task_id as number | undefined;
		const dateRange = args.date_range as { start_date?: string; end_date?: string } | undefined;
		const limitArg = args.limit as number | undefined;

		let limit: number;
		if (limitArg != null && !Number.isNaN(Number(limitArg)) && Number(limitArg) > 0) {
			limit = Math.min(Number(limitArg), 500);
		} else {
			limit = 100;
		}

		const filter: MaintenanceLogsQueryFilter = {
			...(equipmentId != null && !Number.isNaN(Number(equipmentId))
				? { equipment_id: Number(equipmentId) }
				: {}),
			...(taskId != null && !Number.isNaN(Number(taskId)) ? { task_id: Number(taskId) } : {}),
			...(dateRange?.start_date || dateRange?.end_date
				? {
						date_range: {
							...(dateRange.start_date ? { start_date: dateRange.start_date } : {}),
							...(dateRange.end_date ? { end_date: dateRange.end_date } : {})
						}
					}
				: {}),
			limit
		};

		const logs = await maintenanceLogRepository.listWithFilters(this.context.db, filter);
		return {
			type: 'query',
			entity: 'maintenance_log',
			result: logs,
			requires_confirmation: false
		};
	}

	private pickMaintenanceLogToolUpdates(raw: Record<string, unknown>): UpdateMaintenanceLogRequest {
		const updates: UpdateMaintenanceLogRequest = {};
		if (raw.notes !== undefined) updates.notes = raw.notes as string;
		if (raw.cost !== undefined && raw.cost !== null) {
			const c = Number(raw.cost);
			if (!Number.isNaN(c)) updates.cost = c;
		}
		if (raw.parts_used !== undefined) updates.parts_used = raw.parts_used as string;
		if (raw.service_provider !== undefined)
			updates.service_provider = raw.service_provider as string;
		return updates;
	}

	private async updateMaintenanceLog(
		maintenanceLogId: number,
		updatesArg: Record<string, unknown>
	): Promise<ActionResult> {
		if (maintenanceLogId == null || Number.isNaN(Number(maintenanceLogId))) {
			throw new Error('maintenance_log_id is required');
		}
		const log = await maintenanceLogRepository.getById(this.context.db, Number(maintenanceLogId));
		if (!log) {
			throw new Error(`Maintenance log with ID ${maintenanceLogId} not found`);
		}
		const updates = this.pickMaintenanceLogToolUpdates(updatesArg ?? {});
		if (Object.keys(updates).length === 0) {
			throw new Error('At least one field in updates is required');
		}
		if (updates.cost !== undefined && updates.cost < 0) {
			throw new Error('Cost must be non-negative');
		}
		return {
			type: 'update',
			entity: 'maintenance_log',
			data: { id: log.id, updates },
			confirmation_message: `Update maintenance log #${log.id} (completed ${log.completed_date})?`,
			requires_confirmation: true
		};
	}

	private async appendMaintenanceLogNotes(
		maintenanceLogId: number,
		additionalNotes: string
	): Promise<ActionResult> {
		if (maintenanceLogId == null || Number.isNaN(Number(maintenanceLogId))) {
			throw new Error('maintenance_log_id is required');
		}
		const trimmed = typeof additionalNotes === 'string' ? additionalNotes.trim() : '';
		if (!trimmed) {
			throw new Error('additional_notes must be non-empty');
		}
		const log = await maintenanceLogRepository.getById(this.context.db, Number(maintenanceLogId));
		if (!log) {
			throw new Error(`Maintenance log with ID ${maintenanceLogId} not found`);
		}
		const merged = mergeMaintenanceLogNotesForAppend(log.notes, trimmed);
		return {
			type: 'update',
			entity: 'maintenance_log',
			data: { id: log.id, updates: { notes: merged } },
			confirmation_message: `Add notes to maintenance log #${log.id} (completed ${log.completed_date})?`,
			requires_confirmation: true
		};
	}

	private async generateSuggestions(): Promise<ActionResult> {
		const tone = (await globalSettingsRepository.getTypedValue(
			this.context.db,
			'assistant_tone',
			'professional'
		)) as GlobalSettingsValues['assistant_tone'];
		const toneContext = getAssistantToneContext(tone);
		const result = await runProactiveAgent(this.context.db, {
			toneContext,
			skipChangeCheck: true
		});
		return {
			type: 'query',
			entity: 'maintenance_log',
			result: result ?? 'No new suggestions generated; data may be unchanged.',
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
