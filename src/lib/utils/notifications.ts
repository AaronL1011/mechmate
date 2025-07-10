import webpush from 'web-push';
import type {
	Database,
	Task,
	Equipment,
	TaskType,
	NotificationSettingsDisplay,
	NotificationSubscription
} from '../types/db.js';
import type { Kysely } from 'kysely';
import {
	notificationSubscriptionRepository,
	notificationSettingsRepository,
	notificationLogRepository,
	taskRepository,
	equipmentRepository,
	taskTypeRepository
} from '../repositories.js';
import { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } from '$env/static/private';

// VAPID key management
let vapidKeys: { publicKey: string; privateKey: string } | null = null;

export function generateVapidKeys(): { publicKey: string; privateKey: string } {
	if (vapidKeys) {
		return vapidKeys;
	}

	// Generate VAPID keys using web-push
	const keys = webpush.generateVAPIDKeys();
	vapidKeys = keys;

	console.log('Generated new VAPID keys');
	console.log('Public Key:', keys.publicKey);
	console.log('Private Key:', keys.privateKey);

	return keys;
}

export function getVapidKeys(): { publicKey: string; privateKey: string } {
	// Use environment variables if available, otherwise generate new ones
	if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
		return {
			publicKey: VAPID_PUBLIC_KEY,
			privateKey: VAPID_PRIVATE_KEY
		};
	}

	if (!vapidKeys) {
		return generateVapidKeys();
	}
	return vapidKeys;
}

export function initializeWebPush(): void {
	const keys = getVapidKeys();
	const subject = VAPID_SUBJECT || 'mailto:noreply@mechmate.local';

	webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
}

export function isNotificationConfigured(): boolean {
	return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
}

// Notification threshold types
export const THRESHOLD_TYPES = {
	ONE_MONTH: '1_month',
	TWO_WEEKS: '2_weeks',
	ONE_WEEK: '1_week',
	THREE_DAYS: '3_days',
	ONE_DAY: '1_day',
	DUE_DATE: 'due_date',
	OVERDUE_DAILY: 'overdue_daily'
} as const;

export type ThresholdType = (typeof THRESHOLD_TYPES)[keyof typeof THRESHOLD_TYPES];

interface NotificationData {
	title: string;
	body: string;
	icon?: string;
	badge?: string;
	data?: any;
}

interface DueTask {
	task: Task;
	equipment: Equipment;
	taskType: TaskType;
	daysUntilDue: number;
	isOverdue: boolean;
	thresholdType: ThresholdType;
}

// Core notification service
export class NotificationService {
	private db: Kysely<Database>;

	constructor(db: Kysely<Database>) {
		this.db = db;

		// Only initialize web push if properly configured
		if (isNotificationConfigured()) {
			initializeWebPush();
		} else {
			console.warn(
				'Push notifications not configured. VAPID keys missing from environment variables.'
			);
		}
	}

	async sendNotification(
		subscription: NotificationSubscription,
		payload: NotificationData
	): Promise<boolean> {
		if (!isNotificationConfigured()) {
			console.warn('Cannot send notification: VAPID keys not configured');
			return false;
		}

		try {
			const pushPayload = JSON.stringify({
				title: payload.title,
				body: payload.body,
				icon: payload.icon || '/robot.png',
				badge: payload.badge || '/robot.png',
				data: payload.data || { url: '/' }
			});

			await webpush.sendNotification(
				{
					endpoint: subscription.endpoint,
					keys: {
						p256dh: subscription.p256dh_key,
						auth: subscription.auth_key
					}
				},
				pushPayload
			);

			// Update last used timestamp
			await notificationSubscriptionRepository.updateLastUsed(this.db, subscription.id);
			return true;
		} catch (error) {
			console.error('Failed to send notification:', error);

			// If subscription is invalid, remove it
			if (
				error instanceof Error &&
				(error.message.includes('410') || error.message.includes('invalid'))
			) {
				await notificationSubscriptionRepository.delete(this.db, subscription.id);
				console.log(`Removed invalid subscription: ${subscription.id}`);
			}

			return false;
		}
	}

	async broadcastNotification(payload: NotificationData): Promise<number> {
		const subscriptions = await notificationSubscriptionRepository.getAll(this.db);
		let successCount = 0;

		for (const subscription of subscriptions) {
			const success = await this.sendNotification(subscription, payload);
			if (success) {
				successCount++;
			}
		}

		console.log(`Sent notification to ${successCount}/${subscriptions.length} subscriptions`);
		return successCount;
	}

	async sendTestNotification(): Promise<number> {
		const payload: NotificationData = {
			title: 'Mechmate Test Notification',
			body: 'Your notifications are working correctly!',
			data: { url: '/' }
		};

		return this.broadcastNotification(payload);
	}

	async checkAndSendDueNotifications(): Promise<void> {
		console.log('Checking for due notifications...');

		if (!isNotificationConfigured()) {
			console.log('Notifications not configured, skipping check');
			return;
		}

		const settings = await notificationSettingsRepository.get(this.db);
		if (!settings || !settings.enabled) {
			console.log('Notifications disabled, skipping check');
			return;
		}

		const dueTasks = await this.getDueTasks(settings);
		if (dueTasks.length === 0) {
			console.log('No due tasks found');
			return;
		}

		console.log(`Found ${dueTasks.length} due tasks`);

		// Group tasks by threshold type and timeframe for batching
		const groupedTasks = this.groupTasksForNotification(dueTasks);

		for (const group of groupedTasks) {
			await this.sendTaskNotifications(group);
		}
	}

	private async getDueTasks(settings: NotificationSettingsDisplay): Promise<DueTask[]> {
		const allTasks = await taskRepository.getAll(this.db);
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const dueTasks: DueTask[] = [];

		for (const task of allTasks) {
			if (task.status !== 'pending') continue;

			const equipment = await equipmentRepository.getById(this.db, task.equipment_id);
			const taskType = await taskTypeRepository.getById(this.db, task.task_type_id);

			if (!equipment || !taskType) continue;

			// Check each threshold type
			const thresholds = this.getActiveThresholds(settings);

			for (const { type, enabled, days } of thresholds) {
				if (!enabled) continue;

				const shouldNotify = await this.shouldSendNotification(task, type, days, today);

				if (shouldNotify) {
					const daysUntilDue = this.calculateDaysUntilDue(task, today);

					dueTasks.push({
						task,
						equipment,
						taskType,
						daysUntilDue,
						isOverdue: daysUntilDue < 0,
						thresholdType: type
					});
				}
			}
		}

		return dueTasks;
	}

	private getActiveThresholds(settings: NotificationSettingsDisplay) {
		return [
			{ type: THRESHOLD_TYPES.ONE_MONTH, enabled: settings.threshold_1_month, days: 30 },
			{ type: THRESHOLD_TYPES.TWO_WEEKS, enabled: settings.threshold_2_weeks, days: 14 },
			{ type: THRESHOLD_TYPES.ONE_WEEK, enabled: settings.threshold_1_week, days: 7 },
			{ type: THRESHOLD_TYPES.THREE_DAYS, enabled: settings.threshold_3_days, days: 3 },
			{ type: THRESHOLD_TYPES.ONE_DAY, enabled: settings.threshold_1_day, days: 1 },
			{ type: THRESHOLD_TYPES.DUE_DATE, enabled: settings.threshold_due_date, days: 0 },
			{ type: THRESHOLD_TYPES.OVERDUE_DAILY, enabled: settings.threshold_overdue_daily, days: -1 }
		];
	}

	private async shouldSendNotification(
		task: Task,
		thresholdType: ThresholdType,
		thresholdDays: number,
		today: Date
	): Promise<boolean> {
		if (!task.next_due_date) return false;

		const dueDate = new Date(task.next_due_date);
		const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

		// Check if this matches our threshold
		let matches = false;
		if (thresholdType === THRESHOLD_TYPES.OVERDUE_DAILY) {
			matches = daysDiff < 0; // Any overdue task
		} else {
			matches = daysDiff === thresholdDays;
		}

		if (!matches) return false;

		// Check if we've already sent this notification
		const notificationDate = today.toISOString().split('T')[0];
		const alreadySent = await notificationLogRepository.hasBeenSent(
			this.db,
			task.id,
			thresholdType,
			notificationDate
		);

		return !alreadySent;
	}

	private calculateDaysUntilDue(task: Task, today: Date): number {
		if (!task.next_due_date) return Infinity;

		const dueDate = new Date(task.next_due_date);
		return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
	}

	private groupTasksForNotification(dueTasks: DueTask[]): DueTask[][] {
		// Group by timeframe for batching
		const groups = new Map<string, DueTask[]>();

		for (const dueTask of dueTasks) {
			const key = this.getGroupingKey(dueTask);

			if (!groups.has(key)) {
				groups.set(key, []);
			}
			groups.get(key)!.push(dueTask);
		}

		return Array.from(groups.values());
	}

	private getGroupingKey(dueTask: DueTask): string {
		if (dueTask.isOverdue) {
			return 'overdue';
		} else if (dueTask.daysUntilDue === 0) {
			return 'today';
		} else if (dueTask.daysUntilDue <= 7) {
			return 'thisweek';
		} else {
			return 'future';
		}
	}

	private async sendTaskNotifications(tasks: DueTask[]): Promise<void> {
		if (tasks.length === 0) return;

		let payload: NotificationData;

		if (tasks.length === 1 || tasks.length === 2) {
			// Individual notifications for 1-2 tasks
			for (const task of tasks) {
				payload = this.createIndividualNotification(task);
				await this.broadcastNotification(payload);
				await this.logNotification(task);
			}
		} else {
			// Batched notification for 3+ tasks
			payload = this.createBatchedNotification(tasks);
			await this.broadcastNotification(payload);

			// Log each task individually
			for (const task of tasks) {
				await this.logNotification(task);
			}
		}
	}

	private createIndividualNotification(dueTask: DueTask): NotificationData {
		const { equipment, taskType, daysUntilDue, isOverdue } = dueTask;

		let timeframe: string;
		if (isOverdue) {
			const daysPast = Math.abs(daysUntilDue);
			timeframe = daysPast === 1 ? 'yesterday' : `${daysPast} days ago`;
		} else if (daysUntilDue === 0) {
			timeframe = 'today';
		} else if (daysUntilDue === 1) {
			timeframe = 'tomorrow';
		} else {
			timeframe = `in ${daysUntilDue} days`;
		}

		const title = isOverdue ? 'Overdue Maintenance' : 'Upcoming Maintenance';
		const body = `${taskType.name} due for ${equipment.name} ${timeframe}`;

		return {
			title,
			body,
			data: { url: '/' }
		};
	}

	private createBatchedNotification(tasks: DueTask[]): NotificationData {
		const overdueTasks = tasks.filter((t) => t.isOverdue);
		const upcomingTasks = tasks.filter((t) => !t.isOverdue);

		let title: string;
		let body: string;

		if (overdueTasks.length > 0 && upcomingTasks.length > 0) {
			title = 'Maintenance Updates';
			body = `You have ${overdueTasks.length} overdue and ${upcomingTasks.length} upcoming maintenance tasks`;
		} else if (overdueTasks.length > 0) {
			title = 'Overdue Maintenance';
			body = `You have ${overdueTasks.length} overdue maintenance tasks`;
		} else {
			title = 'Upcoming Maintenance';
			const group = this.getGroupingKey(tasks[0]);
			let timeframe = 'soon';

			if (group === 'today') timeframe = 'today';
			else if (group === 'thisweek') timeframe = 'this week';

			body = `You have ${upcomingTasks.length} maintenance tasks due ${timeframe}`;
		}

		return {
			title,
			body,
			data: { url: '/' }
		};
	}

	private async logNotification(dueTask: DueTask): Promise<void> {
		const today = new Date().toISOString().split('T')[0];

		try {
			await notificationLogRepository.log(this.db, dueTask.task.id, dueTask.thresholdType, today);
		} catch (error) {
			console.error('Failed to log notification:', error);
		}
	}
}
