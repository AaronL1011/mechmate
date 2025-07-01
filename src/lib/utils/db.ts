import { Kysely, sql } from 'kysely';
import type { Database } from '../types/db.js';
import type { Transaction } from 'kysely';

export async function initializeTables(db: Kysely<Database>) {
	await db.schema
		.createTable('equipment')
		.ifNotExists()
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('name', 'text', (col) => col.notNull())
		.addColumn('type', 'text', (col) => col.notNull())
		.addColumn('equipment_type_id', 'integer', (col) => col.notNull())
		.addColumn('make', 'text')
		.addColumn('model', 'text')
		.addColumn('year', 'integer')
		.addColumn('serial_number', 'text')
		.addColumn('purchase_date', 'text')
		.addColumn('current_usage_value', 'real', (col) => col.notNull().defaultTo(0))
		.addColumn('usage_unit', 'text', (col) => col.notNull())
		.addColumn('metadata', 'text') // JSON string for flexible equipment-specific data
		.addColumn('tags', 'text') // JSON array of tags
		.addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute();

	await db.schema
		.createTable('equipment_types')
		.ifNotExists()
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('name', 'text', (col) => col.notNull())
		.execute();

	await db.schema
		.createTable('task_types')
		.ifNotExists()
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('name', 'text', (col) => col.notNull())
		.addColumn('description', 'text')
		.addColumn('estimated_duration_minutes', 'integer')
		.addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute();

	await db.schema
		.createTable('tasks')
		.ifNotExists()
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('equipment_id', 'integer', (col) => col.notNull())
		.addColumn('task_type_id', 'integer', (col) => col.notNull())
		.addColumn('title', 'text', (col) => col.notNull())
		.addColumn('description', 'text')
		.addColumn('usage_interval', 'real')
		.addColumn('time_interval_days', 'integer')
		.addColumn('last_completed_usage_value', 'real')
		.addColumn('last_completed_date', 'text')
		.addColumn('next_due_usage_value', 'real')
		.addColumn('next_due_date', 'text')
		.addColumn('priority', 'text', (col) => col.notNull().defaultTo('medium'))
		.addColumn('status', 'text', (col) => col.notNull().defaultTo('pending'))
		.addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.addForeignKeyConstraint('tasks_equipment_fk', ['equipment_id'], 'equipment', ['id'], (cb) => cb.onDelete('cascade'))
		.addForeignKeyConstraint('tasks_task_type_fk', ['task_type_id'], 'task_types', ['id'], (cb) => cb.onDelete('cascade'))
		.execute();

	await db.schema
		.createTable('maintenance_logs')
		.ifNotExists()
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('task_id', 'integer', (col) => col.notNull())
		.addColumn('equipment_id', 'integer', (col) => col.notNull())
		.addColumn('completed_date', 'text', (col) => col.notNull())
		.addColumn('completed_usage_value', 'real')
		.addColumn('notes', 'text')
		.addColumn('cost', 'real')
		.addColumn('parts_used', 'text') // JSON array of parts
		.addColumn('service_provider', 'text')
		.addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.addForeignKeyConstraint('maintenance_logs_task_fk', ['task_id'], 'tasks', ['id'], (cb) => cb.onDelete('cascade'))
		.addForeignKeyConstraint('maintenance_logs_equipment_fk', ['equipment_id'], 'equipment', ['id'], (cb) => cb.onDelete('cascade'))
		.execute();

	await db.schema
		.createTable('maintenance_log_attachments')
		.ifNotExists()
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('maintenance_log_id', 'integer', (col) => col.notNull())
		.addColumn('filename', 'text', (col) => col.notNull())
		.addColumn('original_filename', 'text', (col) => col.notNull())
		.addColumn('mime_type', 'text', (col) => col.notNull())
		.addColumn('file_size', 'integer', (col) => col.notNull())
		.addColumn('file_path', 'text', (col) => col.notNull())
		.addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.addForeignKeyConstraint('attachments_log_fk', ['maintenance_log_id'], 'maintenance_logs', ['id'], (cb) => cb.onDelete('cascade'))
		.execute();

	// Notification tables
	await db.schema
		.createTable('notification_subscriptions')
		.ifNotExists()
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('endpoint', 'text', (col) => col.notNull().unique())
		.addColumn('p256dh_key', 'text', (col) => col.notNull())
		.addColumn('auth_key', 'text', (col) => col.notNull())
		.addColumn('user_agent', 'text')
		.addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.addColumn('last_used_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute();

	await db.schema
		.createTable('notification_settings')
		.ifNotExists()
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('enabled', 'integer', (col) => col.notNull().defaultTo(0))
		.addColumn('threshold_1_month', 'integer', (col) => col.notNull().defaultTo(0))
		.addColumn('threshold_2_weeks', 'integer', (col) => col.notNull().defaultTo(0))
		.addColumn('threshold_1_week', 'integer', (col) => col.notNull().defaultTo(1))
		.addColumn('threshold_3_days', 'integer', (col) => col.notNull().defaultTo(0))
		.addColumn('threshold_1_day', 'integer', (col) => col.notNull().defaultTo(1))
		.addColumn('threshold_due_date', 'integer', (col) => col.notNull().defaultTo(1))
		.addColumn('threshold_overdue_daily', 'integer', (col) => col.notNull().defaultTo(0))
		.addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute();

	await db.schema
		.createTable('notification_log')
		.ifNotExists()
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('task_id', 'integer', (col) => col.notNull())
		.addColumn('threshold_type', 'text', (col) => col.notNull())
		.addColumn('notification_date', 'text', (col) => col.notNull())
		.addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.addForeignKeyConstraint('notification_log_task_fk', ['task_id'], 'tasks', ['id'], (cb) => cb.onDelete('cascade'))
		.execute();

	// Create indexes for performance
	await db.schema.createIndex('idx_equipment_type').ifNotExists().on('equipment').column('type').execute();
	await db.schema.createIndex('idx_tasks_equipment').ifNotExists().on('tasks').column('equipment_id').execute();
	await db.schema.createIndex('idx_tasks_status').ifNotExists().on('tasks').column('status').execute();
	await db.schema.createIndex('idx_tasks_next_due').ifNotExists().on('tasks').columns(['next_due_date', 'next_due_usage_value']).execute();
	await db.schema.createIndex('idx_maintenance_logs_task').ifNotExists().on('maintenance_logs').column('task_id').execute();
	await db.schema.createIndex('idx_maintenance_logs_equipment').ifNotExists().on('maintenance_logs').column('equipment_id').execute();
	await db.schema.createIndex('idx_maintenance_logs_date').ifNotExists().on('maintenance_logs').column('completed_date').execute();
	await db.schema.createIndex('idx_attachments_log').ifNotExists().on('maintenance_log_attachments').column('maintenance_log_id').execute();
	
	// Notification indexes
	await db.schema.createIndex('idx_notification_subscriptions_endpoint').ifNotExists().on('notification_subscriptions').column('endpoint').execute();
	await db.schema.createIndex('idx_notification_log_task_threshold').ifNotExists().on('notification_log').columns(['task_id', 'threshold_type', 'notification_date']).execute();

	// Global Settings table
	await db.schema
		.createTable('global_settings')
		.ifNotExists()
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('setting_key', 'text', (col) => col.notNull().unique())
		.addColumn('setting_value', 'text', (col) => col.notNull())
		.addColumn('data_type', 'text', (col) => col.notNull().check(sql`data_type IN ('integer', 'boolean', 'string', 'json')`))
		.addColumn('description', 'text')
		.addColumn('default_value', 'text', (col) => col.notNull())
		.addColumn('min_value', 'text')
		.addColumn('max_value', 'text')
		.addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute();

	// Global Settings indexes
	await db.schema.createIndex('idx_global_settings_key').ifNotExists().on('global_settings').column('setting_key').execute();
}

export async function seedData(db: Kysely<Database>) {
	await db.transaction().execute(async (txn) => {
		await seedEquipmentTypes(txn);
		await seedTaskTypes(txn);
		await seedNotificationSettings(txn);
		await seedGlobalSettings(txn);
	});
}

async function seedEquipmentTypes(txn: Transaction<Database>) {
	const defaultEquipmentTypes = [
		{ id: 1, name: 'vehicle' },
		{ id: 2, name: 'appliance' },
		{ id: 3, name: 'tool' },
		{ id: 4, name: 'system' },
		{ id: 5, name: 'device' },
		{ id: 6, name: 'other' }
	];

	await txn
		.insertInto('equipment_types')
		.values(defaultEquipmentTypes)
		.onConflict((oc) => oc.doNothing())
		.execute();
}

async function seedTaskTypes(txn: Transaction<Database>) {
	// mechmateDefaultTaskTypes.ts
 	const defaultTaskTypes = [
		{
		id: 1,
		name: 'Fluid Change',
		description:
			'Drain and refill lubricating, hydraulic, or cooling fluids (engine oil, gearbox oil, coolant, hydraulic oil, etc.)',
		estimated_duration_minutes: 60
		},
		{
		id: 2,
		name: 'Filter Replacement',
		description: 'Replace air, fuel, water, particulate, or oil filters',
		estimated_duration_minutes: 30
		},
		{
		id: 3,
		name: 'General Inspection',
		description: 'Visual / functional check for leaks, wear, play, noise, or damage',
		estimated_duration_minutes: 45
		},
		{
		id: 4,
		name: 'Cleaning',
		description: 'Remove dirt, dust, grease, or residue from key components or housings',
		estimated_duration_minutes: 30
		},
		{
		id: 5,
		name: 'Lubrication',
		description: 'Apply grease or oil to bearings, pivots, chains, slides, or other moving parts',
		estimated_duration_minutes: 20
		},
		{
		id: 6,
		name: 'Drive Component Service',
		description: 'Inspect, adjust, or replace belts, chains, cables, sprockets, or pulleys',
		estimated_duration_minutes: 90
		},
		{
		id: 7,
		name: 'Fastener Torque Check',
		description: 'Tighten bolts, screws, lugs, and clamps to specified torque values',
		estimated_duration_minutes: 25
		},
		{
		id: 8,
		name: 'Calibration / Alignment',
		description: 'Calibrate sensors, tools, or align mechanical / optical components for accuracy',
		estimated_duration_minutes: 60
		},
		{
		id: 9,
		name: 'Electrical / Battery Service',
		description: 'Test, charge, or replace batteries; inspect wiring, connectors, and fuses',
		estimated_duration_minutes: 40
		},
		{
		id: 10,
		name: 'Software / Firmware Update',
		description: 'Update onboard firmware, embedded software, or configuration files',
		estimated_duration_minutes: 30
		},
		{
		id: 11,
		name: 'Wear-Part Replacement',
		description: 'Replace consumables such as brake pads, spark plugs, seals, blades, or gaskets',
		estimated_duration_minutes: 60
		},
		{
		id: 12,
		name: 'Seasonal Storage / Preservation',
		description: 'Prepare equipment for long-term storage (fuel stabiliser, rust inhibition, draining, etc.)',
		estimated_duration_minutes: 90
		}
	] as const;

	await txn
		.insertInto('task_types')
		.values(defaultTaskTypes)
		.onConflict((oc) => oc.doNothing())
		.execute();
}

async function seedNotificationSettings(txn: Transaction<Database>) {
	// Create default notification settings (single row for single-user app)
	// SQLite stores booleans as integers: 0 for false, 1 for true
	const defaultSettings = {
		id: 1,
		enabled: 0, // Disabled by default, user must opt-in
		threshold_1_month: 0,
		threshold_2_weeks: 0,
		threshold_1_week: 1,
		threshold_3_days: 0,
		threshold_1_day: 1,
		threshold_due_date: 1,
		threshold_overdue_daily: 0
	};

	await txn
		.insertInto('notification_settings')
		.values(defaultSettings)
		.onConflict((oc) => oc.doNothing())
		.execute();
}

async function seedGlobalSettings(txn: Transaction<Database>) {
	// Create default global settings
	const defaultGlobalSettings = [
		{
			setting_key: 'upcoming_task_range_days',
			setting_value: '90',
			data_type: 'integer' as const,
			description: 'Number of days to look ahead for upcoming tasks',
			default_value: '90',
			min_value: '1',
			max_value: '365'
		}
	];

	await txn
		.insertInto('global_settings')
		.values(defaultGlobalSettings)
		.onConflict((oc) => oc.doNothing())
		.execute();
}