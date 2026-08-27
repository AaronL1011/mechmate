import * as cron from 'node-cron';
import type { Kysely } from 'kysely';
import type { Database } from '../types/db.js';
import { NotificationService } from './notifications.js';
import { backupManager } from './backup.js';
import { getConfig } from '../config.js';
import { globalSettingsRepository } from '../repositories.js';
import * as pendingActions from '../agent/pending-actions.js';
import { runProactiveAgent, pruneOldSuggestions } from '../agent/proactive.js';
import { getAssistantToneContext } from '../agent/prompts.js';
import { llmService } from '../services/llm.js';
import type { GlobalSettingsValues } from '../types/db.js';

let schedulerInstance: NotificationScheduler | null = null;

export class NotificationScheduler {
	private db: Kysely<Database>;
	private notificationService: NotificationService;
	private notificationCronJob: cron.ScheduledTask | null = null;
	private backupCronJob: cron.ScheduledTask | null = null;
	private proactiveCronJob: cron.ScheduledTask | null = null;
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

		this.notificationCronJob = cron.schedule(
			notificationSchedule,
			async () => {
				console.log('Running scheduled notification check...');
				try {
					await this.notificationService.checkAndSendDueNotifications();
				} catch (error) {
					console.error('Error in scheduled notification check:', error);
				}
				try {
					const deleted = await pendingActions.deleteExpiredPendingActions(this.db);
					if (deleted > 0) {
						console.log(`Cleaned up ${deleted} expired agent pending actions`);
					}
				} catch (error) {
					console.error('Error cleaning expired pending actions:', error);
				}
				try {
					const pruned = await pruneOldSuggestions(this.db);
					if (pruned > 0) {
						console.log(`Pruned ${pruned} proactive suggestions older than 90 days`);
					}
				} catch (error) {
					console.error('Error pruning old proactive suggestions:', error);
				}
			},
			{
				timezone: process.env.TZ || 'UTC'
			}
		);

		// Schedule proactive agent (daily at 22:00 UTC)
		const proactiveSchedule = process.env.PROACTIVE_CRON_SCHEDULE || '0 22 * * *';
		if (llmService.isConfigured()) {
			console.log(`🤖 Starting proactive agent scheduler with schedule: ${proactiveSchedule}`);
			this.proactiveCronJob = cron.schedule(
				proactiveSchedule,
				async () => {
					console.log('Running proactive agent...');
					try {
						const tone = (await globalSettingsRepository.getTypedValue(
							this.db,
							'assistant_tone',
							'professional'
						)) as GlobalSettingsValues['assistant_tone'];
						const toneContext = getAssistantToneContext(tone);
						const result = await runProactiveAgent(this.db, { toneContext });
						if (result) {
							console.log('Proactive agent completed; suggestions stored.');
						} else {
							console.warn('Proactive agent produced no output.');
						}
					} catch (error) {
						console.error('Error in proactive agent:', error);
					}
				},
				{
					timezone: process.env.TZ || 'UTC'
				}
			);
		}

		// Schedule automatic backups if enabled
		if (config.AUTO_BACKUP_ENABLED) {
			const backupIntervalHours = config.AUTO_BACKUP_INTERVAL_HOURS;
			const backupSchedule = `0 */${backupIntervalHours} * * *`; // Every N hours
			console.log(`⏳ Starting backup scheduler with schedule: ${backupSchedule}`);

			this.backupCronJob = cron.schedule(
				backupSchedule,
				async () => {
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
				},
				{
					timezone: process.env.TZ || 'UTC'
				}
			);
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

		if (this.proactiveCronJob) {
			this.proactiveCronJob.stop();
			this.proactiveCronJob = null;
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
