import type { RequestHandler } from './$types';
import { maintenanceLogRepository } from '$lib/repositories.js';

function escapeCsv(value: string | number | null | undefined): string {
	if (value === null || value === undefined) return '""';
	const s = String(value).replace(/"/g, '""');
	return `"${s}"`;
}

export const GET: RequestHandler = async ({ url, locals }) => {
	const startDate = url.searchParams.get('start_date') ?? undefined;
	const endDate = url.searchParams.get('end_date') ?? undefined;

	const rows = await maintenanceLogRepository.getAllForExport(
		locals.db,
		startDate || undefined,
		endDate || undefined
	);

	const headers = [
		'Equipment',
		'Task',
		'Date',
		'Usage at completion',
		'Notes',
		'Cost',
		'Service provider',
		'Parts used'
	];
	const lines = [
		headers.map(escapeCsv).join(','),
		...rows.map((r) =>
			[
				r.equipment_name,
				r.task_title,
				r.completed_date,
				r.completed_usage_value ?? '',
				r.notes ?? '',
				r.cost ?? '',
				r.service_provider ?? '',
				r.parts_used ? (typeof r.parts_used === 'string' ? r.parts_used : JSON.stringify(r.parts_used)) : ''
			].map(escapeCsv).join(',')
		)
	];

	const csv = lines.join('\n');
	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="maintenance-logs-export-${new Date().toISOString().split('T')[0]}.csv"`
		}
	});
};
