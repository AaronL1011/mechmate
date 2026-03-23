import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { getUploadDir } from '$lib/config.js';
import { maintenanceLogRepository, maintenanceLogAttachmentRepository } from '$lib/repositories.js';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const logId = Number(params.logId);
	const attachmentId = Number(params.attachmentId);
	if (Number.isNaN(logId) || Number.isNaN(attachmentId)) {
		return json({ error: 'Invalid ID', code: 'VALIDATION_ERROR' }, { status: 400 });
	}
	const log = await maintenanceLogRepository.getById(locals.db, logId);
	if (!log) {
		return json({ error: 'Maintenance log not found', code: 'NOT_FOUND' }, { status: 404 });
	}
	const attachment = await maintenanceLogAttachmentRepository.getById(locals.db, attachmentId);
	if (!attachment || attachment.maintenance_log_id !== logId) {
		return json({ error: 'Attachment not found', code: 'NOT_FOUND' }, { status: 404 });
	}
	const fullPath = join(getUploadDir(), attachment.file_path);
	try {
		await unlink(fullPath);
	} catch (err) {
		console.warn('Could not delete attachment file:', fullPath, err);
	}
	await maintenanceLogAttachmentRepository.delete(locals.db, attachmentId);
	return new Response(null, { status: 204 });
};
