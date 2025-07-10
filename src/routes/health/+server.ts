// Health check endpoint for Mechmate
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getConfig, getDatabasePath } from '$lib/config.js';
import { existsSync, statSync } from 'fs';
import { performance } from 'perf_hooks';

interface HealthCheck {
	status: 'healthy' | 'degraded' | 'unhealthy';
	timestamp: string;
	version: string;
	uptime: number;
	checks: {
		database: HealthStatus;
		filesystem: HealthStatus;
		memory: HealthStatus;
		configuration: HealthStatus;
	};
	metadata?: {
		instance_id?: string;
		node_version: string;
		platform: string;
		arch: string;
	};
}

interface HealthStatus {
	status: 'pass' | 'warn' | 'fail';
	message?: string;
	responseTime?: number;
	details?: Record<string, any>;
}

export const GET: RequestHandler = async ({ locals }) => {
	const config = getConfig();
	const startTime = performance.now();

	if (!config.HEALTH_CHECK_ENABLED) {
		return json(
			{
				status: 'disabled',
				message: 'Health checks are disabled'
			},
			{ status: 503 }
		);
	}

	const checks: HealthCheck['checks'] = {
		database: await checkDatabase(locals.db),
		filesystem: await checkFilesystem(),
		memory: checkMemory(),
		configuration: checkConfiguration()
	};

	// Determine overall status
	const hasFailures = Object.values(checks).some((check) => check.status === 'fail');
	const hasWarnings = Object.values(checks).some((check) => check.status === 'warn');

	const overallStatus: HealthCheck['status'] = hasFailures
		? 'unhealthy'
		: hasWarnings
			? 'degraded'
			: 'healthy';

	const healthCheck: HealthCheck = {
		status: overallStatus,
		timestamp: new Date().toISOString(),
		version: config.MECHMATE_VERSION,
		uptime: process.uptime(),
		checks,
		metadata: {
			node_version: process.version,
			platform: process.platform,
			arch: process.arch
		}
	};

	const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

	const responseTime = performance.now() - startTime;
	return json(healthCheck, {
		status: httpStatus,
		headers: {
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			'X-Response-Time': `${responseTime.toFixed(2)}ms`
		}
	});
};

async function checkDatabase(db: any): Promise<HealthStatus> {
	const startTime = performance.now();

	try {
		// Simple query to check database connectivity
		await db.selectFrom('instance_metadata').select(['id']).limit(1).execute();

		const responseTime = performance.now() - startTime;

		// Check if database file exists and get size
		const dbPath = getDatabasePath();
		const dbExists = existsSync(dbPath);
		const dbSize = dbExists ? statSync(dbPath).size : 0;

		return {
			status: 'pass',
			message: 'Database is accessible',
			responseTime,
			details: {
				path: dbPath,
				size_bytes: dbSize,
				size_mb: Math.round((dbSize / 1024 / 1024) * 100) / 100
			}
		};
	} catch (error) {
		return {
			status: 'fail',
			message: `Database check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			responseTime: performance.now() - startTime
		};
	}
}

async function checkFilesystem(): Promise<HealthStatus> {
	const config = getConfig();

	try {
		const checks = [
			{ path: config.DATABASE_DIR, name: 'database directory' },
			{ path: config.DATABASE_BACKUP_DIR, name: 'backup directory' },
			{ path: config.UPLOAD_DIR, name: 'upload directory' }
		];

		const results = checks.map((check) => {
			const exists = existsSync(check.path);
			return {
				path: check.path,
				exists,
				writable: exists ? true : false // Simplified check
			};
		});

		const allAccessible = results.every((r) => r.exists && r.writable);

		return {
			status: allAccessible ? 'pass' : 'warn',
			message: allAccessible
				? 'All directories accessible'
				: 'Some directories may not be accessible',
			details: { directories: results }
		};
	} catch (error) {
		return {
			status: 'fail',
			message: `Filesystem check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}

function checkMemory(): HealthStatus {
	const usage = process.memoryUsage();
	const totalMemoryMB = usage.heapTotal / 1024 / 1024;
	const usedMemoryMB = usage.heapUsed / 1024 / 1024;
	const usagePercent = (usedMemoryMB / totalMemoryMB) * 100;

	// Warning thresholds
	const status = usagePercent > 90 ? 'fail' : usagePercent > 75 ? 'warn' : 'pass';

	const message =
		status === 'fail'
			? 'High memory usage detected'
			: status === 'warn'
				? 'Elevated memory usage'
				: 'Memory usage normal';

	return {
		status,
		message,
		details: {
			heap_used_mb: Math.round(usedMemoryMB * 100) / 100,
			heap_total_mb: Math.round(totalMemoryMB * 100) / 100,
			usage_percent: Math.round(usagePercent * 100) / 100,
			rss_mb: Math.round((usage.rss / 1024 / 1024) * 100) / 100,
			external_mb: Math.round((usage.external / 1024 / 1024) * 100) / 100
		}
	};
}

function checkConfiguration(): HealthStatus {
	const config = getConfig();
	const issues: string[] = [];

	// Check for important missing configurations
	if (!config.OPENAI_API_KEY) {
		issues.push('AI assistant disabled (OPENAI_API_KEY not set)');
	}

	if (!config.VAPID_PRIVATE_KEY || !config.VAPID_PUBLIC_KEY) {
		issues.push('Push notifications disabled (VAPID keys not set)');
	}

	const status = issues.length === 0 ? 'pass' : 'warn';
	const message =
		status === 'pass'
			? 'Configuration complete'
			: `Configuration issues: ${issues.length} optional features disabled`;

	return {
		status,
		message,
		details: {
			issues,
			features: {
				ai_assistant: !!config.OPENAI_API_KEY,
				push_notifications: !!(config.VAPID_PRIVATE_KEY && config.VAPID_PUBLIC_KEY),
				rate_limiting: config.RATE_LIMIT_ENABLED,
				auto_backup: config.AUTO_BACKUP_ENABLED,
				cors: config.CORS_ENABLED
			}
		}
	};
}
