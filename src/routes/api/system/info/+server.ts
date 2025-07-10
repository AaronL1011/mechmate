// System information endpoint for diagnostics and support
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getConfig, getDatabasePath, getBackupDir, getUploadDir } from '$lib/config.js';
import { existsSync, statSync } from 'fs';

interface SystemInfo {
	instance: {
		id?: string;
		name: string;
		version: string;
		deployment_type: string;
		uptime: number;
		started_at: string;
	};
	environment: {
		node_version: string;
		platform: string;
		arch: string;
		environment: string;
	};
	storage: {
		database: {
			path: string;
			exists: boolean;
			size_bytes?: number;
			size_mb?: number;
		};
		directories: {
			backup: string;
			upload: string;
		};
	};
	features: {
		ai_assistant: boolean;
		push_notifications: boolean;
		rate_limiting: boolean;
		auto_backup: boolean;
		cors: boolean;
		health_checks: boolean;
		metrics: boolean;
	};
	configuration: {
		port: number;
		host: string;
		log_level: string;
		upload_max_size_mb: number;
		backup_retention_days: number;
		rate_limit_max_requests?: number;
		rate_limit_window_minutes?: number;
	};
}

export const GET: RequestHandler = async ({ locals }) => {
	const config = getConfig();

	try {
		// Get instance metadata from database
		let instanceData;
		try {
			instanceData = await locals.db
				.selectFrom('instance_metadata')
				.selectAll()
				.limit(1)
				.executeTakeFirst();
		} catch (err) {
			console.warn('Failed to fetch instance metadata:', err);
		}

		// Get database information
		const dbPath = getDatabasePath();
		const dbExists = existsSync(dbPath);
		let dbSize: number | undefined;
		let dbSizeMB: number | undefined;

		if (dbExists) {
			try {
				const stats = statSync(dbPath);
				dbSize = stats.size;
				dbSizeMB = Math.round(dbSize / 1024 / 1024 * 100) / 100;
			} catch (err) {
				console.warn('Failed to get database size:', err);
			}
		}

		// Calculate startup time
		const startedAt = new Date(Date.now() - process.uptime() * 1000).toISOString();

		const systemInfo: SystemInfo = {
			instance: {
				id: instanceData?.instance_id,
				name: config.INSTANCE_NAME,
				version: config.MECHMATE_VERSION,
				deployment_type: instanceData?.deployment_type || 'self-hosted',
				uptime: process.uptime(),
				started_at: startedAt
			},
			environment: {
				node_version: process.version,
				platform: process.platform,
				arch: process.arch,
				environment: config.NODE_ENV
			},
			storage: {
				database: {
					path: dbPath,
					exists: dbExists,
					...(dbSize && { size_bytes: dbSize }),
					...(dbSizeMB && { size_mb: dbSizeMB })
				},
				directories: {
					backup: getBackupDir(),
					upload: getUploadDir()
				}
			},
			features: {
				ai_assistant: !!config.OPENAI_API_KEY,
				push_notifications: !!(config.VAPID_PRIVATE_KEY && config.VAPID_PUBLIC_KEY),
				rate_limiting: config.RATE_LIMIT_ENABLED,
				auto_backup: config.AUTO_BACKUP_ENABLED,
				cors: config.CORS_ENABLED,
				health_checks: config.HEALTH_CHECK_ENABLED,
				metrics: config.METRICS_ENABLED
			},
			configuration: {
				port: config.PORT,
				host: config.HOST,
				log_level: config.LOG_LEVEL,
				upload_max_size_mb: config.UPLOAD_MAX_SIZE_MB,
				backup_retention_days: config.DATABASE_BACKUP_RETENTION_DAYS,
				...(config.RATE_LIMIT_ENABLED && {
					rate_limit_max_requests: config.RATE_LIMIT_MAX_REQUESTS,
					rate_limit_window_minutes: Math.round(config.RATE_LIMIT_WINDOW_MS / 60000)
				})
			}
		};

		return json(systemInfo, {
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate'
			}
		});

	} catch (err) {
		console.error('Failed to gather system information:', err);
		throw error(500, 'Failed to gather system information');
	}
};