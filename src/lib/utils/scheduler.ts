import cron from 'node-cron';
import type { Kysely } from 'kysely';
import type { Database } from '../types/db.js';
import { NotificationService } from './notifications.js';
import { backupManager } from './backup.js';
import { getConfig } from '../config.js';

let schedulerInstance: NotificationScheduler | null = null;

export class NotificationScheduler {
	private db: Kysely<Database>;
	private notificationService: NotificationService;
	private notificationCronJob: cron.ScheduledTask | null = null;
	private backupCronJob: cron.ScheduledTask | null = null;
	private isRunning = false;

	constructor(db: Kysely<Database>) {
		this.db = db;
		this.notificationService = new NotificationService(db);
	}

	start(): void {
		if (this.isRunning) {
			console.log('Scheduler is already running');
			return;
		}

		const config = getConfig();
		
		// Schedule notifications (every hour at minute 0)
		const notificationSchedule = process.env.NOTIFICATION_CRON_SCHEDULE || '0 * * * *';
		console.log(`📬 Starting notification scheduler with schedule: ${notificationSchedule}`);

		this.notificationCronJob = cron.schedule(notificationSchedule, async () => {
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

		// Schedule automatic backups if enabled
		if (config.AUTO_BACKUP_ENABLED) {
			const backupIntervalHours = config.AUTO_BACKUP_INTERVAL_HOURS;
			const backupSchedule = `0 */${backupIntervalHours} * * *`; // Every N hours
			console.log(`⏳ Starting backup scheduler with schedule: ${backupSchedule}`);

			this.backupCronJob = cron.schedule(backupSchedule, async () => {
				console.log('Running scheduled automatic backup...');
				try {
					const result = await backupManager.createBackup('automatic');
					if (result.success) {
						console.log(`Automatic backup created: ${result.filename} (${result.size} bytes)`);
					} else {
						console.error('Automatic backup failed:', result.error);
					}
				} catch (error) {
					console.error('Error in scheduled backup:', error);
				}
			}, {
				scheduled: true,
				timezone: process.env.TZ || 'UTC'
			});
		}

		this.isRunning = true;
		console.log('✅ Scheduler started successfully');
	}

	stop(): void {
		if (!this.isRunning) {
			console.log('Scheduler is not running');
			return;
		}

		if (this.notificationCronJob) {
			this.notificationCronJob.stop();
			this.notificationCronJob = null;
		}

		if (this.backupCronJob) {
			this.backupCronJob.stop();
			this.backupCronJob = null;
		}

		this.isRunning = false;
		console.log('Scheduler stopped');
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