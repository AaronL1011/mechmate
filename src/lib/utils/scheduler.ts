import cron from 'node-cron';
import type { Kysely } from 'kysely';
import type { Database } from '../types/db.js';
import { NotificationService } from './notifications.js';

let schedulerInstance: NotificationScheduler | null = null;

export class NotificationScheduler {
	private db: Kysely<Database>;
	private notificationService: NotificationService;
	private cronJob: cron.ScheduledTask | null = null;
	private isRunning = false;

	constructor(db: Kysely<Database>) {
		this.db = db;
		this.notificationService = new NotificationService(db);
	}

	start(): void {
		if (this.isRunning) {
			console.log('Notification scheduler is already running');
			return;
		}

		// Schedule to run every hour at minute 0
		// You can customize this schedule via environment variable
		const schedule = process.env.NOTIFICATION_CRON_SCHEDULE || '0 * * * *';
		
		console.log(`Starting notification scheduler with schedule: ${schedule}`);

		this.cronJob = cron.schedule(schedule, async () => {
			console.log('Running scheduled notification check...');
			try {
				await this.notificationService.checkAndSendDueNotifications();
			} catch (error) {
				console.error('Error in scheduled notification check:', error);
			}
		}, {
			scheduled: true,
			timezone: process.env.TZ || 'UTC'
		});

		this.isRunning = true;
		console.log('Notification scheduler started successfully');
	}

	stop(): void {
		if (!this.isRunning || !this.cronJob) {
			console.log('Notification scheduler is not running');
			return;
		}

		this.cronJob.stop();
		this.cronJob = null;
		this.isRunning = false;
		console.log('Notification scheduler stopped');
	}

	getStatus(): { running: boolean; schedule: string } {
		return {
			running: this.isRunning,
			schedule: process.env.NOTIFICATION_CRON_SCHEDULE || '0 * * * *'
		};
	}

	// Manual trigger for testing
	async triggerCheck(): Promise<void> {
		console.log('Manually triggering notification check...');
		await this.notificationService.checkAndSendDueNotifications();
	}
}

// Singleton instance management
export function getScheduler(db: Kysely<Database>): NotificationScheduler {
	if (!schedulerInstance) {
		schedulerInstance = new NotificationScheduler(db);
	}
	return schedulerInstance;
}

export function startScheduler(db: Kysely<Database>): void {
	const scheduler = getScheduler(db);
	scheduler.start();
}

export function stopScheduler(): void {
	if (schedulerInstance) {
		schedulerInstance.stop();
	}
}