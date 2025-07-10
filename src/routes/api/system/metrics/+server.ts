// System metrics endpoint for monitoring and diagnostics
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getConfig } from '$lib/config.js';
import { dashboardRepository } from '$lib/repositories.js';
import { performance } from 'perf_hooks';

interface SystemMetrics {
	timestamp: string;
	uptime: number;
	memory: {
		heap_used_mb: number;
		heap_total_mb: number;
		rss_mb: number;
		external_mb: number;
		usage_percent: number;
	};
	database: {
		total_equipment: number;
		total_tasks: number;
		upcoming_jobs: number;
		overdue_jobs: number;
		total_maintenance_logs?: number;
	};
	application: {
		version: string;
		node_version: string;
		platform: string;
		arch: string;
		environment: string;
	};
	performance: {
		response_time_ms: number;
	};
}

export const GET: RequestHandler = async ({ locals, url }) => {
	const startTime = performance.now();
	const config = getConfig();

	// Check if metrics are enabled
	if (!config.METRICS_ENABLED) {
		throw error(403, 'Metrics endpoint is disabled');
	}

	try {
		// Gather system metrics
		const memoryUsage = process.memoryUsage();
		const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
		const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
		const usagePercent = (heapUsedMB / heapTotalMB) * 100;

		// Get application statistics
		const stats = await dashboardRepository.getStats(locals.db);

		// Check if detailed metrics are requested
		const includeDetails = url.searchParams.get('details') === 'true';
		let totalMaintenanceLogs: number | undefined;

		if (includeDetails) {
			try {
				const logResult = await locals.db
					.selectFrom('maintenance_logs')
					.select((eb) => eb.fn.count<number>('id').as('count'))
					.executeTakeFirst();
				totalMaintenanceLogs = Number(logResult?.count) || 0;
			} catch (err) {
				console.warn('Failed to fetch maintenance log count:', err);
			}
		}

		const responseTime = performance.now() - startTime;

		const metrics: SystemMetrics = {
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			memory: {
				heap_used_mb: Math.round(heapUsedMB * 100) / 100,
				heap_total_mb: Math.round(heapTotalMB * 100) / 100,
				rss_mb: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
				external_mb: Math.round((memoryUsage.external / 1024 / 1024) * 100) / 100,
				usage_percent: Math.round(usagePercent * 100) / 100
			},
			database: {
				total_equipment: stats.total_equipment,
				total_tasks: stats.total_tasks,
				upcoming_jobs: stats.upcoming_jobs,
				overdue_jobs: stats.overdue_jobs,
				...(includeDetails && { total_maintenance_logs: totalMaintenanceLogs })
			},
			application: {
				version: config.MECHMATE_VERSION,
				node_version: process.version,
				platform: process.platform,
				arch: process.arch,
				environment: config.NODE_ENV
			},
			performance: {
				response_time_ms: Math.round(responseTime * 100) / 100
			}
		};

		return json(metrics, {
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				'X-Response-Time': `${responseTime.toFixed(2)}ms`
			}
		});
	} catch (err) {
		console.error('Failed to gather system metrics:', err);
		throw error(500, 'Failed to gather system metrics');
	}
};
