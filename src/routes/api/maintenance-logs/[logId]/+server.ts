import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { maintenanceLogRepository } from '$lib/repositories.js';
import type { PutMaintenanceLogRequest, UpdateMaintenanceLogRequest } from '$lib/types/db.js';

function parseLogId(raw: string | undefined): number | null {
	if (raw == null) return null;
	const id = Number(raw);
	return Number.isNaN(id) ? null : id;
}

function pickMaintenanceLogUpdates(body: PutMaintenanceLogRequest): UpdateMaintenanceLogRequest {
	const updates: UpdateMaintenanceLogRequest = {};
	if (body.notes !== undefined) updates.notes = body.notes;
	if (body.cost !== undefined) updates.cost = body.cost;
	if (body.parts_used !== undefined) updates.parts_used = body.parts_used;
	if (body.service_provider !== undefined) updates.service_provider = body.service_provider;
	return updates;
}

export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const logId = parseLogId(params.logId);
		if (logId == null) {
			return json({ error: 'Invalid log ID' }, { status: 400 });
		}

		const log = await maintenanceLogRepository.getById(locals.db, logId);
		if (!log) {
			return json({ error: 'Maintenance log not found' }, { status: 404 });
		}

		return json(log);
	} catch (error) {
		console.error('Error fetching maintenance log:', error);
		return json({ error: 'Failed to fetch maintenance log' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	try {
		const logId = parseLogId(params.logId);
		if (logId == null) {
			return json({ error: 'Invalid log ID' }, { status: 400 });
		}

		const existing = await maintenanceLogRepository.getById(locals.db, logId);
		if (!existing) {
			return json({ error: 'Maintenance log not found' }, { status: 404 });
		}

		const body = (await request.json()) as PutMaintenanceLogRequest;
		if (body.cost !== undefined && body.cost < 0) {
			return json({ error: 'Cost must be non-negative' }, { status: 400 });
		}

		const appendNotes = typeof body.append_notes === 'string' ? body.append_notes : undefined;
		const fieldUpdates = pickMaintenanceLogUpdates(body);
		const hasFieldUpdates = Object.keys(fieldUpdates).length > 0;

		let log = existing;
		if (hasFieldUpdates) {
			const updated = await maintenanceLogRepository.update(locals.db, logId, fieldUpdates);
			if (updated) log = updated;
		}

		if (appendNotes?.trim()) {
			const appended = await maintenanceLogRepository.appendNotes(locals.db, logId, appendNotes);
			if (appended) log = appended;
		}

		return json(log);
	} catch (error) {
		console.error('Error updating maintenance log:', error);
		return json({ error: 'Failed to update maintenance log' }, { status: 500 });
	}
};
