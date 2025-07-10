import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

export interface Database {
	equipment: EquipmentTable;
	equipment_types: EquipmentTypesTable;
	task_types: TaskTypesTable;
	tasks: TasksTable;
	maintenance_logs: MaintenanceLogsTable;
	maintenance_log_attachments: MaintenanceLogAttachmentsTable;
	notification_subscriptions: NotificationSubscriptionsTable;
	notification_settings: NotificationSettingsTable;
	notification_log: NotificationLogTable;
	global_settings: GlobalSettingsTable;
	quick_edit_actions: QuickEditActionsTable;
	instance_metadata: InstanceMetadataTable;
	system_info: SystemInfoTable;
}

export interface EquipmentTable {
	id: Generated<number>;
	name: string;
	equipment_type_id: number;
	make?: string;
	model?: string;
	year?: number;
	serial_number?: string;
	purchase_date?: string;
	current_usage_value: number;
	usage_unit: string;
	metadata?: string; // JSON string for flexible equipment-specific data
	tags?: string; // JSON array of tags
	user_id?: string; // Future-proofing for multi-user support
	created_at: ColumnType<Date, string | undefined, never>;
	updated_at: ColumnType<Date, string | undefined, never>;
}

export type Equipment = Selectable<EquipmentTable>;
export type NewEquipment = Insertable<EquipmentTable>;
export type EquipmentUpdate = Updateable<EquipmentTable>;

export interface EquipmentTypesTable {
	id: Generated<number>;
	name: string;
}
export type EquipmentType = Selectable<EquipmentTypesTable>;
export type NewEquipmentType = Insertable<EquipmentTypesTable>;
export type EquipmentTypeUpdate = Updateable<EquipmentTypesTable>;

export interface TaskTypesTable {
	id: Generated<number>;
	name: string;
	description?: string;
	estimated_duration_minutes?: number;
	created_at: ColumnType<Date, string | undefined, never>;
}

export type TaskType = Selectable<TaskTypesTable>;
export type NewTaskType = Insertable<TaskTypesTable>;
export type TaskTypeUpdate = Updateable<TaskTypesTable>;

export interface TasksTable {
	id: Generated<number>;
	equipment_id: number;
	task_type_id: number;
	title: string;
	description?: string;
	usage_interval?: number;
	time_interval_days?: number;
	last_completed_usage_value?: number;
	last_completed_date?: string;
	next_due_usage_value?: number;
	next_due_date?: string;
	priority: 'low' | 'medium' | 'high' | 'critical';
	status: 'pending' | 'completed' | 'overdue';
	user_id?: string; // Future-proofing for multi-user support
	created_at: ColumnType<Date, string | undefined, never>;
	updated_at: ColumnType<Date, string | undefined, never>;
}

export type Task = Selectable<TasksTable>;
export type NewTask = Insertable<TasksTable>;
export type TaskUpdate = Updateable<TasksTable>;

export interface MaintenanceLogsTable {
	id: Generated<number>;
	task_id: number;
	equipment_id: number;
	completed_date: string;
	completed_usage_value?: number;
	notes?: string;
	cost?: number;
	parts_used?: string; // JSON array of parts
	service_provider?: string;
	user_id?: string; // Future-proofing for multi-user support
	created_at: ColumnType<Date, string | undefined, never>;
}

export type MaintenanceLog = Selectable<MaintenanceLogsTable>;
export type NewMaintenanceLog = Insertable<MaintenanceLogsTable>;
export type MaintenanceLogUpdate = Updateable<MaintenanceLogsTable>;

export interface MaintenanceLogAttachmentsTable {
	id: Generated<number>;
	maintenance_log_id: number;
	filename: string;
	original_filename: string;
	mime_type: string;
	file_size: number;
	file_path: string;
	created_at: ColumnType<Date, string | undefined, never>;
}

export type MaintenanceLogAttachment = Selectable<MaintenanceLogAttachmentsTable>;
export type NewMaintenanceLogAttachment = Insertable<MaintenanceLogAttachmentsTable>;
export type MaintenanceLogAttachmentUpdate = Updateable<MaintenanceLogAttachmentsTable>;

// Extended types for complex queries
export interface TaskWithDetails extends Task {
	equipment: Equipment;
	task_type: TaskType;
	maintenance_logs: MaintenanceLog[];
}

export interface TaskCompletion {
	id: number;
	task_id: number;
	equipment_id: number;
	completed_date: string;
	completed_usage_value?: number;
	notes?: string;
	cost?: number;
	parts_used?: string[];
	service_provider?: string;
	created_at: string;
	task_title?: string;
}

export interface DashboardStats {
	total_equipment: number;
	upcoming_jobs: number;
	overdue_jobs: number;
	total_tasks: number;
}

// Request/Response types
export interface CreateEquipmentRequest {
	name: string;
	equipment_type_id: number;
	make?: string;
	model?: string;
	year?: number;
	serial_number?: string;
	purchase_date?: string;
	current_usage_value: number;
	usage_unit: string;
	metadata?: Record<string, any>;
	tags?: string[];
}

export interface CreateEquipmentTypeRequest {
	name: string;
}

export interface CreateTaskRequest {
	equipment_id: number;
	task_type_id: number;
	title: string;
	description?: string;
	usage_interval?: number;
	time_interval_days?: number;
	priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface CompleteTaskRequest {
	task_id: number;
	completed_date: string;
	completed_usage_value?: number;
	notes?: string;
	cost?: number;
	parts_used?: string[];
	service_provider?: string;
}

export interface UpdateEquipmentRequest {
	name?: string;
	equipment_type_id?: number;
	make?: string;
	model?: string;
	year?: number;
	serial_number?: string;
	purchase_date?: string;
	current_usage_value?: number;
	usage_unit?: string;
	metadata?: Record<string, any>;
	tags?: string[];
}

export interface UpdateTaskRequest {
	title?: string;
	description?: string;
	usage_interval?: number;
	time_interval_days?: number;
	priority?: 'low' | 'medium' | 'high' | 'critical';
	status?: 'pending' | 'completed' | 'overdue';
	last_completed_date?: string;
	last_completed_usage_value?: number;
	next_due_date?: string;
	next_due_usage_value?: number;
}

// Notification Tables
export interface NotificationSubscriptionsTable {
	id: Generated<number>;
	endpoint: string;
	p256dh_key: string;
	auth_key: string;
	user_agent?: string;
	user_id?: string; // Future-proofing for multi-user support
	created_at: ColumnType<Date, string | undefined, never>;
	last_used_at: ColumnType<Date, string | undefined, never>;
}

export type NotificationSubscription = Selectable<NotificationSubscriptionsTable>;
export type NewNotificationSubscription = Insertable<NotificationSubscriptionsTable>;
export type NotificationSubscriptionUpdate = Updateable<NotificationSubscriptionsTable>;

export interface NotificationSettingsTable {
	id: Generated<number>;
	enabled: number; // SQLite stores booleans as integers (0/1)
	threshold_1_month: number;
	threshold_2_weeks: number;
	threshold_1_week: number;
	threshold_3_days: number;
	threshold_1_day: number;
	threshold_due_date: number;
	threshold_overdue_daily: number;
	created_at: ColumnType<Date, string | undefined, never>;
	updated_at: ColumnType<Date, string | undefined, never>;
}

export type NotificationSettings = Selectable<NotificationSettingsTable>;
export type NewNotificationSettings = Insertable<NotificationSettingsTable>;
export type NotificationSettingsUpdate = Updateable<NotificationSettingsTable>;

export interface NotificationLogTable {
	id: Generated<number>;
	task_id: number;
	threshold_type: string;
	notification_date: string;
	created_at: ColumnType<Date, string | undefined, never>;
}

export type NotificationLog = Selectable<NotificationLogTable>;
export type NewNotificationLog = Insertable<NotificationLogTable>;
export type NotificationLogUpdate = Updateable<NotificationLogTable>;

// Notification Request/Response Types
export interface PushSubscriptionData {
	endpoint: string;
	keys: {
		p256dh: string;
		auth: string;
	};
	userAgent?: string;
}

export interface NotificationSettingsRequest {
	enabled: boolean;
	threshold_1_month: boolean;
	threshold_2_weeks: boolean;
	threshold_1_week: boolean;
	threshold_3_days: boolean;
	threshold_1_day: boolean;
	threshold_due_date: boolean;
	threshold_overdue_daily: boolean;
}

// Helper types for converting between boolean UI and integer DB values
export interface NotificationSettingsDisplay {
	id: number;
	enabled: boolean;
	threshold_1_month: boolean;
	threshold_2_weeks: boolean;
	threshold_1_week: boolean;
	threshold_3_days: boolean;
	threshold_1_day: boolean;
	threshold_due_date: boolean;
	threshold_overdue_daily: boolean;
	created_at: Date;
	updated_at: Date;
}

// Global Settings Tables
export interface GlobalSettingsTable {
	id: Generated<number>;
	setting_key: string;
	setting_value: string;
	data_type: 'integer' | 'boolean' | 'string' | 'json';
	description?: string;
	default_value: string;
	min_value?: string;
	max_value?: string;
	created_at: ColumnType<Date, string | undefined, never>;
	updated_at: ColumnType<Date, string | undefined, never>;
}

export type GlobalSetting = Selectable<GlobalSettingsTable>;
export type NewGlobalSetting = Insertable<GlobalSettingsTable>;
export type GlobalSettingUpdate = Updateable<GlobalSettingsTable>;

// Application-Level Global Settings Types
export interface GlobalSettingsValues {
	upcoming_task_range_days: number;
	preferred_measurement_system: 'metric' | 'imperial';
	assistant_tone: 'professional' | 'friendly' | 'blunt' | 'educational' | 'cheeky';
}

export interface UpdateGlobalSettingRequest {
	setting_key: string;
	setting_value: string;
}

export interface GlobalSettingDefinition {
	key: string;
	dataType: 'integer' | 'boolean' | 'string' | 'json';
	defaultValue: any;
	description: string;
	validation?: {
		min?: number | string;
		max?: number | string;
		allowedValues?: any[];
	};
}

// Quick Edit Actions Table
export interface QuickEditActionsTable {
	id: string; // UUID primary key
	user_prompt: string;
	interpreted_action: string; // JSON string
	status: 'pending' | 'confirmed' | 'cancelled' | 'executed';
	created_at: ColumnType<Date, string | undefined, never>;
	executed_at?: ColumnType<Date, string | undefined, never>;
	result?: string; // JSON string of execution result
}

export type QuickEditAction = Selectable<QuickEditActionsTable>;
export type NewQuickEditAction = Insertable<QuickEditActionsTable>;
export type QuickEditActionUpdate = Updateable<QuickEditActionsTable>;

// Instance Metadata Table
export interface InstanceMetadataTable {
	id: Generated<number>;
	instance_id: string;
	version: string;
	deployment_type: string;
	created_at: ColumnType<Date, string | undefined, never>;
	last_updated: ColumnType<Date, string | undefined, never>;
	settings?: string; // JSON string
}

export type InstanceMetadata = Selectable<InstanceMetadataTable>;
export type NewInstanceMetadata = Insertable<InstanceMetadataTable>;
export type InstanceMetadataUpdate = Updateable<InstanceMetadataTable>;

// System Info Table
export interface SystemInfoTable {
	id: Generated<number>;
	info_type: string; // 'startup', 'health_check', 'error'
	data: string; // JSON string
	created_at: ColumnType<Date, string | undefined, never>;
}

export type SystemInfo = Selectable<SystemInfoTable>;
export type NewSystemInfo = Insertable<SystemInfoTable>;
export type SystemInfoUpdate = Updateable<SystemInfoTable>;
