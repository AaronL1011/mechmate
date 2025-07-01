import type {
	Database,
	Equipment,
	Task,
	TaskType,
	MaintenanceLog,
	TaskWithDetails,
	DashboardStats,
	CreateEquipmentRequest,
	CreateTaskRequest,
	CompleteTaskRequest,
	UpdateEquipmentRequest,
	UpdateTaskRequest,
	NewEquipment,
	NewTask,
	NewMaintenanceLog,
	EquipmentType,
	CreateEquipmentTypeRequest,
	NotificationSubscription,
	NotificationSettings,
	NotificationLog,
	NewNotificationSubscription,
	NewNotificationSettings,
	NewNotificationLog,
	NotificationSettingsRequest,
	NotificationSettingsDisplay,
	PushSubscriptionData,
	GlobalSetting,
	NewGlobalSetting,
	GlobalSettingUpdate,
	GlobalSettingsValues,
	UpdateGlobalSettingRequest
} from './types/db.js';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';

// Helper functions for notification boolean/integer conversion
function convertSettingsToDisplay(settings: NotificationSettings): NotificationSettingsDisplay {
	return {
		id: settings.id,
		enabled: Boolean(settings.enabled),
		threshold_1_month: Boolean(settings.threshold_1_month),
		threshold_2_weeks: Boolean(settings.threshold_2_weeks),
		threshold_1_week: Boolean(settings.threshold_1_week),
		threshold_3_days: Boolean(settings.threshold_3_days),
		threshold_1_day: Boolean(settings.threshold_1_day),
		threshold_due_date: Boolean(settings.threshold_due_date),
		threshold_overdue_daily: Boolean(settings.threshold_overdue_daily),
		created_at: settings.created_at,
		updated_at: settings.updated_at
	};
}

function convertRequestToDb(request: NotificationSettingsRequest) {
	return {
		enabled: request.enabled ? 1 : 0,
		threshold_1_month: request.threshold_1_month ? 1 : 0,
		threshold_2_weeks: request.threshold_2_weeks ? 1 : 0,
		threshold_1_week: request.threshold_1_week ? 1 : 0,
		threshold_3_days: request.threshold_3_days ? 1 : 0,
		threshold_1_day: request.threshold_1_day ? 1 : 0,
		threshold_due_date: request.threshold_due_date ? 1 : 0,
		threshold_overdue_daily: request.threshold_overdue_daily ? 1 : 0
	};
}

// Helper functions for global settings type conversion
function convertSettingValue<T>(value: string, dataType: string, defaultValue: T): T {
	try {
		switch (dataType) {
			case 'integer':
				return Number(value) as T;
			case 'boolean':
				return (value === 'true' || value === '1') as T;
			case 'json':
				return JSON.parse(value) as T;
			case 'string':
			default:
				return value as T;
		}
	} catch {
		return defaultValue;
	}
}

function getDefaultSettings(): GlobalSettingsValues {
	return {
		upcoming_task_range_days: 90
	};
}

// Global Settings Repository
export const globalSettingsRepository = {
	getAll: (db: Kysely<Database>): Promise<GlobalSetting[]> => {
		return db.selectFrom('global_settings').selectAll().orderBy('setting_key').execute();
	},

	getByKey: (db: Kysely<Database>, key: string): Promise<GlobalSetting | undefined> => {
		return db.selectFrom('global_settings').selectAll().where('setting_key', '=', key).executeTakeFirst();
	},

	getTypedValue: async <T>(db: Kysely<Database>, key: string, defaultValue: T): Promise<T> => {
		const setting = await db.selectFrom('global_settings').selectAll().where('setting_key', '=', key).executeTakeFirst();
		
		if (!setting) return defaultValue;
		
		return convertSettingValue(setting.setting_value, setting.data_type, defaultValue);
	},

	getAllAsObject: async (db: Kysely<Database>): Promise<GlobalSettingsValues> => {
		const settings = await db.selectFrom('global_settings').selectAll().execute();
		
		const result: any = {};
		for (const setting of settings) {
			result[setting.setting_key] = convertSettingValue(
				setting.setting_value, 
				setting.data_type, 
				setting.default_value
			);
		}
		
		// Merge with defaults for any missing settings
		return { ...getDefaultSettings(), ...result };
	},

	updateByKey: async (db: Kysely<Database>, key: string, value: string): Promise<GlobalSetting | undefined> => {
		return db
			.updateTable('global_settings')
			.set({ 
				setting_value: value, 
				updated_at: sql`CURRENT_TIMESTAMP` 
			})
			.where('setting_key', '=', key)
			.returningAll()
			.executeTakeFirst();
	},

	validateSetting: async (db: Kysely<Database>, key: string, value: string): Promise<{ valid: boolean; error?: string }> => {
		const setting = await db.selectFrom('global_settings').selectAll().where('setting_key', '=', key).executeTakeFirst();
		
		if (!setting) {
			return { valid: false, error: 'Setting not found' };
		}

		// Type validation
		try {
			switch (setting.data_type) {
				case 'integer': {
					const numValue = Number(value);
					if (isNaN(numValue) || !Number.isInteger(numValue)) {
						return { valid: false, error: 'Value must be an integer' };
					}
					
					// Range validation
					if (setting.min_value && numValue < Number(setting.min_value)) {
						return { valid: false, error: `Value must be at least ${setting.min_value}` };
					}
					if (setting.max_value && numValue > Number(setting.max_value)) {
						return { valid: false, error: `Value must be at most ${setting.max_value}` };
					}
					break;
				}
				case 'boolean':
					if (!['true', 'false', '0', '1'].includes(value)) {
						return { valid: false, error: 'Value must be true, false, 0, or 1' };
					}
					break;
				case 'json':
					JSON.parse(value); // Will throw if invalid
					break;
				// string type needs no special validation
			}
		} catch (error) {
			return { valid: false, error: `Invalid ${setting.data_type} value` };
		}

		return { valid: true };
	}
};

// Equipment Repository
export const equipmentRepository = {
	getAll: (db: Kysely<Database>): Promise<Equipment[]> => {
		return db.selectFrom('equipment').selectAll().orderBy('name').execute();
	},

	getById: (db: Kysely<Database>, id: number): Promise<Equipment | undefined> => {
		return db.selectFrom('equipment').selectAll().where('id', '=', id).executeTakeFirst();
	},

	create: async (db: Kysely<Database>, equipment: CreateEquipmentRequest): Promise<Equipment> => {
		const newEquipment: NewEquipment = {
			name: equipment.name,
			type: equipment.type,
			equipment_type_id: equipment.equipment_type_id,
			make: equipment.make,
			model: equipment.model,
			year: equipment.year,
			serial_number: equipment.serial_number,
			purchase_date: equipment.purchase_date,
			current_usage_value: equipment.current_usage_value,
			usage_unit: equipment.usage_unit,
			metadata: equipment.metadata ? JSON.stringify(equipment.metadata) : undefined,
			tags: equipment.tags ? JSON.stringify(equipment.tags) : undefined
		};

		const result = await db
			.insertInto('equipment')
			.values(newEquipment)
			.returningAll()
			.executeTakeFirstOrThrow();

		return result;
	},

	update: async (db: Kysely<Database>, id: number, updates: UpdateEquipmentRequest): Promise<Equipment | undefined> => {
		const updateData: any = {};
		
		if (updates.name !== undefined) updateData.name = updates.name;
		if (updates.type !== undefined) updateData.type = updates.type;
		if (updates.equipment_type_id !== undefined) updateData.equipment_type_id = updates.equipment_type_id;
		if (updates.make !== undefined) updateData.make = updates.make;
		if (updates.model !== undefined) updateData.model = updates.model;
		if (updates.year !== undefined) updateData.year = updates.year;
		if (updates.serial_number !== undefined) updateData.serial_number = updates.serial_number;
		if (updates.purchase_date !== undefined) updateData.purchase_date = updates.purchase_date;
		if (updates.current_usage_value !== undefined) updateData.current_usage_value = updates.current_usage_value;
		if (updates.usage_unit !== undefined) updateData.usage_unit = updates.usage_unit;
		if (updates.metadata !== undefined) updateData.metadata = JSON.stringify(updates.metadata);
		if (updates.tags !== undefined) updateData.tags = JSON.stringify(updates.tags);

		const result = await db
			.updateTable('equipment')
			.set(updateData)
			.where('id', '=', id)
			.returningAll()
			.executeTakeFirst();

		return result;
	},

	delete: async (db: Kysely<Database>, id: number): Promise<boolean> => {
		const result = await db.deleteFrom('equipment').where('id', '=', id).execute();
		return result.length > 0;
	}
};

// Equipment Type Repository
export const equipmentTypeRepository = {
	getAll: (db: Kysely<Database>): Promise<EquipmentType[]> => {
		return db.selectFrom('equipment_types').selectAll().orderBy('name').execute();
	},

	getById: (db: Kysely<Database>, id: number): Promise<EquipmentType | undefined> => {
		return db.selectFrom('equipment_types').selectAll().where('id', '=', id).executeTakeFirst();
	},

	create: async (db: Kysely<Database>, equipmentType: CreateEquipmentTypeRequest): Promise<EquipmentType | undefined> => {
		const result = await db
			.insertInto('equipment_types')
			.values({ name: equipmentType.name.toLowerCase() })
			.returningAll()
			.executeTakeFirstOrThrow();

		return result;
	},
};

// Task Type Repository
export const taskTypeRepository = {
	getAll: (db: Kysely<Database>): Promise<TaskType[]> => {
		return db.selectFrom('task_types').selectAll().orderBy('name').execute();
	},

	getById: (db: Kysely<Database>, id: number): Promise<TaskType | undefined> => {
		return db.selectFrom('task_types').selectAll().where('id', '=', id).executeTakeFirst();
	}
};

// Task Repository
export const taskRepository = {
	getAll: (db: Kysely<Database>): Promise<Task[]> => {
		return db
			.selectFrom('tasks')
			.selectAll()
			.orderBy('next_due_date')
			.orderBy('next_due_usage_value')
			.execute();
	},

	getById: (db: Kysely<Database>, id: number): Promise<Task | undefined> => {
		return db.selectFrom('tasks').selectAll().where('id', '=', id).executeTakeFirst();
	},

	getWithDetails: async (db: Kysely<Database>, id: number): Promise<TaskWithDetails | undefined> => {
		const task = await db
			.selectFrom('tasks')
			.innerJoin('equipment', 'tasks.equipment_id', 'equipment.id')
			.innerJoin('task_types', 'tasks.task_type_id', 'task_types.id')
			.selectAll()
			.where('tasks.id', '=', id)
			.executeTakeFirst();

		if (!task) return undefined;

		// Transform the flat result into nested structure
		const taskData: Task = {
			id: task.id,
			equipment_id: task.equipment_id,
			task_type_id: task.task_type_id,
			title: task.title,
			description: task.description,
			usage_interval: task.usage_interval,
			time_interval_days: task.time_interval_days,
			last_completed_usage_value: task.last_completed_usage_value,
			last_completed_date: task.last_completed_date,
			next_due_usage_value: task.next_due_usage_value,
			next_due_date: task.next_due_date,
			priority: task.priority,
			status: task.status,
			created_at: task.created_at,
			updated_at: task.updated_at
		};

		const equipment: Equipment = {
			id: task.equipment_id,
			name: task.name,
			type: task.type,
			equipment_type_id: task.equipment_type_id,
			make: task.make,
			model: task.model,
			year: task.year,
			serial_number: task.serial_number,
			purchase_date: task.purchase_date,
			current_usage_value: task.current_usage_value,
			usage_unit: task.usage_unit,
			metadata: task.metadata,
			tags: task.tags,
			created_at: task.created_at,
			updated_at: task.updated_at
		};

		const taskType: TaskType = {
			id: task.task_type_id,
			name: task.name,
			description: task.description,
			estimated_duration_minutes: task.estimated_duration_minutes,
			created_at: task.created_at
		};

		// Get maintenance logs for this task
		const maintenanceLogs = await db
			.selectFrom('maintenance_logs')
			.selectAll()
			.where('task_id', '=', id)
			.orderBy('completed_date desc')
			.execute();

		return {
			...taskData,
			equipment,
			task_type: taskType,
			maintenance_logs: maintenanceLogs
		};
	},

	getUpcoming: async (db: Kysely<Database>, customDays?: number): Promise<Task[]> => {
		const days = customDays ?? await globalSettingsRepository.getTypedValue(db, 'upcoming_task_range_days', 90);
		const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
		return db
			.selectFrom('tasks')
			.selectAll()
			.where('status', '=', 'pending')
			.where((eb) => 
				eb.or([
					eb('next_due_date', 'is', null),
					eb('next_due_date', '<=', futureDate)
				])
			)
			.orderBy('next_due_date')
			.orderBy('next_due_usage_value')
			.execute();
	},

	getOverdue: (db: Kysely<Database>): Promise<Task[]> => {
		const today = new Date().toISOString().split('T')[0];
		return db
			.selectFrom('tasks')
			.innerJoin('equipment', 'tasks.equipment_id', 'equipment.id')
			.selectAll()
			.where('tasks.status', '=', 'pending')
			.where((eb) => 
				eb.or([
					eb('tasks.next_due_date', '<', today),
					eb.and([
						eb('tasks.next_due_usage_value', 'is not', null),
						eb('tasks.next_due_usage_value', '<=', eb.ref('equipment.current_usage_value'))
					])
				])
			)
			.orderBy('tasks.next_due_date')
      .orderBy('tasks.next_due_usage_value')
			.execute();
	},

	create: async (db: Kysely<Database>, task: CreateTaskRequest): Promise<Task> => {
		const nextDueDate = task.time_interval_days ? new Date(Date.now() + task.time_interval_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined;
		const newTask: NewTask = {
			equipment_id: task.equipment_id,
			task_type_id: task.task_type_id,
			title: task.title,
			description: task.description,
			usage_interval: task.usage_interval,
			time_interval_days: task.time_interval_days,
			priority: task.priority || 'medium',
			status: 'pending',
			next_due_date: nextDueDate
		};

		const result = await db
			.insertInto('tasks')
			.values(newTask)
			.returningAll()
			.executeTakeFirstOrThrow();

		return result;
	},

	update: async (db: Kysely<Database>, id: number, updates: UpdateTaskRequest): Promise<Task | undefined> => {
		const updateData: any = {};
		
		if (updates.title !== undefined) updateData.title = updates.title;
		if (updates.description !== undefined) updateData.description = updates.description;
		if (updates.usage_interval !== undefined) updateData.usage_interval = updates.usage_interval;
		if (updates.time_interval_days !== undefined) updateData.time_interval_days = updates.time_interval_days;
		if (updates.priority !== undefined) updateData.priority = updates.priority;
		if (updates.status !== undefined) updateData.status = updates.status;
		if (updates.next_due_date !== undefined) updateData.next_due_date = updates.next_due_date;
		if (updates.next_due_usage_value !== undefined) updateData.next_due_usage_value = updates.next_due_usage_value;
		if (updates.last_completed_usage_value !== undefined) updateData.last_completed_usage_value = updates.last_completed_usage_value;
		if (updates.last_completed_date !== undefined) updateData.last_completed_date = updates.last_completed_date;

		const result = await db
			.updateTable('tasks')
			.set(updateData)
			.where('id', '=', id)
			.returningAll()
			.executeTakeFirst();

		return result;
	},

	delete: async (db: Kysely<Database>, id: number): Promise<boolean> => {
		const result = await db.deleteFrom('tasks').where('id', '=', id).execute();
		return result.length > 0;
	}
};

// Maintenance Log Repository
export const maintenanceLogRepository = {
	getAll: (db: Kysely<Database>): Promise<MaintenanceLog[]> => {
		return db
			.selectFrom('maintenance_logs')
			.selectAll()
			.orderBy('completed_date', 'desc')
			.execute();
	},

	getById: (db: Kysely<Database>, id: number): Promise<MaintenanceLog | undefined> => {
		return db.selectFrom('maintenance_logs').selectAll().where('id', '=', id).executeTakeFirst();
	},

	getByTaskId: (db: Kysely<Database>, taskId: number): Promise<MaintenanceLog[]> => {
		return db
			.selectFrom('maintenance_logs')
			.selectAll()
			.where('task_id', '=', taskId)
			.orderBy('completed_date', 'desc')
			.execute();
	},

	getByEquipmentId: async (db: Kysely<Database>, equipmentId: number): Promise<any[]> => {
		return db
			.selectFrom('maintenance_logs')
			.innerJoin('tasks', 'maintenance_logs.task_id', 'tasks.id')
			.select([
				'maintenance_logs.id',
				'maintenance_logs.task_id',
				'maintenance_logs.equipment_id',
				'maintenance_logs.completed_date',
				'maintenance_logs.completed_usage_value',
				'maintenance_logs.notes',
				'maintenance_logs.cost',
				'maintenance_logs.parts_used',
				'maintenance_logs.service_provider',
				'maintenance_logs.created_at',
				'tasks.title as task_title'
			])
			.where('maintenance_logs.equipment_id', '=', equipmentId)
			.orderBy('maintenance_logs.completed_date', 'desc')
			.execute();
	},

	create: async (db: Kysely<Database>, log: Omit<MaintenanceLog, 'id' | 'created_at'>): Promise<MaintenanceLog> => {
		const newLog: NewMaintenanceLog = {
			task_id: log.task_id,
			equipment_id: log.equipment_id,
			completed_date: log.completed_date,
			completed_usage_value: log.completed_usage_value,
			notes: log.notes,
			cost: log.cost,
			parts_used: log.parts_used,
			service_provider: log.service_provider
		};

		const result = await db
			.insertInto('maintenance_logs')
			.values(newLog)
			.returningAll()
			.executeTakeFirstOrThrow();

		return result;
	}
};

// Dashboard Repository
export const dashboardRepository = {
	getStats: async (db: Kysely<Database>): Promise<DashboardStats> => {
		const days = await globalSettingsRepository.getTypedValue(db, 'upcoming_task_range_days', 90);
		const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
		const today = new Date().toISOString().split('T')[0];
		
		const [equipmentCount, taskCount, upcomingCount, overdueCount] = await Promise.all([
			db.selectFrom('equipment').select(db.fn.count<number>('id').as('count')).executeTakeFirstOrThrow(),
			db.selectFrom('tasks').select(db.fn.count<number>('id').as('count')).executeTakeFirstOrThrow(),
			db
				.selectFrom('tasks')
				.select(db.fn.count<number>('id').as('count'))
				.where('status', '=', 'pending')
				.where((eb) => 
					eb.or([
						eb('next_due_date', 'is', null),
						eb('next_due_date', '<=', futureDate)
					])
				)
				.executeTakeFirstOrThrow(),
			db
				.selectFrom('tasks')
				.innerJoin('equipment', 'tasks.equipment_id', 'equipment.id')
				.select(db.fn.count<number>('tasks.id').as('count'))
				.where('tasks.status', '=', 'pending')
				.where((eb) => 
					eb.or([
						eb('tasks.next_due_date', '<', today),
						eb.and([
							eb('tasks.next_due_usage_value', 'is not', null),
							eb('tasks.next_due_usage_value', '<=', eb.ref('equipment.current_usage_value'))
						])
					])
				)
				.executeTakeFirstOrThrow()
		]);

		return {
			total_equipment: Number(equipmentCount.count),
			upcoming_jobs: Number(upcomingCount.count),
			overdue_jobs: Number(overdueCount.count),
			total_tasks: Number(taskCount.count)
		};
	}
};

// Notification Subscription Repository
export const notificationSubscriptionRepository = {
	getAll: (db: Kysely<Database>): Promise<NotificationSubscription[]> => {
		return db
			.selectFrom('notification_subscriptions')
			.selectAll()
			.orderBy('created_at', 'desc')
			.execute();
	},

	getById: (db: Kysely<Database>, id: number): Promise<NotificationSubscription | undefined> => {
		return db
			.selectFrom('notification_subscriptions')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirst();
	},

	getByEndpoint: (db: Kysely<Database>, endpoint: string): Promise<NotificationSubscription | undefined> => {
		return db
			.selectFrom('notification_subscriptions')
			.selectAll()
			.where('endpoint', '=', endpoint)
			.executeTakeFirst();
	},

	create: async (db: Kysely<Database>, subscription: PushSubscriptionData): Promise<NotificationSubscription> => {
		const newSubscription: NewNotificationSubscription = {
			endpoint: subscription.endpoint,
			p256dh_key: subscription.keys.p256dh,
			auth_key: subscription.keys.auth,
			user_agent: subscription.userAgent
		};

		const result = await db
			.insertInto('notification_subscriptions')
			.values(newSubscription)
			.returningAll()
			.executeTakeFirstOrThrow();

		return result;
	},

	updateLastUsed: async (db: Kysely<Database>, id: number): Promise<void> => {
		await db
			.updateTable('notification_subscriptions')
			.set({ last_used_at: sql`CURRENT_TIMESTAMP` })
			.where('id', '=', id)
			.execute();
	},

	delete: async (db: Kysely<Database>, id: number): Promise<boolean> => {
		const result = await db
			.deleteFrom('notification_subscriptions')
			.where('id', '=', id)
			.execute();
		return result.length > 0;
	},

	deleteByEndpoint: async (db: Kysely<Database>, endpoint: string): Promise<boolean> => {
		const result = await db
			.deleteFrom('notification_subscriptions')
			.where('endpoint', '=', endpoint)
			.execute();
		return result.length > 0;
	}
};

// Notification Settings Repository
export const notificationSettingsRepository = {
	get: async (db: Kysely<Database>): Promise<NotificationSettingsDisplay | undefined> => {
		const settings = await db
			.selectFrom('notification_settings')
			.selectAll()
			.where('id', '=', 1) // Single user app, always use id=1
			.executeTakeFirst();

		return settings ? convertSettingsToDisplay(settings) : undefined;
	},

	update: async (db: Kysely<Database>, settings: NotificationSettingsRequest): Promise<NotificationSettingsDisplay> => {
		const dbSettings = convertRequestToDb(settings);
		
		const result = await db
			.updateTable('notification_settings')
			.set({
				...dbSettings,
				updated_at: sql`CURRENT_TIMESTAMP`
			})
			.where('id', '=', 1)
			.returningAll()
			.executeTakeFirstOrThrow();

		return convertSettingsToDisplay(result);
	}
};

// Notification Log Repository
export const notificationLogRepository = {
	hasBeenSent: async (db: Kysely<Database>, taskId: number, thresholdType: string, notificationDate: string): Promise<boolean> => {
		const result = await db
			.selectFrom('notification_log')
			.select(['id'])
			.where('task_id', '=', taskId)
			.where('threshold_type', '=', thresholdType)
			.where('notification_date', '=', notificationDate)
			.executeTakeFirst();

		return result !== undefined;
	},

	log: async (db: Kysely<Database>, taskId: number, thresholdType: string, notificationDate: string): Promise<NotificationLog> => {
		const newLog: NewNotificationLog = {
			task_id: taskId,
			threshold_type: thresholdType,
			notification_date: notificationDate
		};

		const result = await db
			.insertInto('notification_log')
			.values(newLog)
			.returningAll()
			.executeTakeFirstOrThrow();

		return result;
	},

	cleanup: async (db: Kysely<Database>, olderThanDays: number = 90): Promise<void> => {
		const cutoffDate = new Date(Date.now() + olderThanDays * 24 * 60 * 60 * 1000);

		
		await db
			.deleteFrom('notification_log')
			.where('created_at', '<', cutoffDate)
			.execute();
	}
}; 