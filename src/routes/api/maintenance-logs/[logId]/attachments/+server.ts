import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConfig, getUploadDir } from '$lib/config.js';
import { maintenanceLogRepository, maintenanceLogAttachmentRepository } from '$lib/repositories.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf'];

function isAllowedMime(mime: string): boolean {
	return ALLOWED_MIME_PREFIXES.some((p) => mime.toLowerCase().startsWith(p));
}

function safeFilename(original: string): string {
	const ext = original.includes('.') ? original.slice(original.lastIndexOf('.')) : '';
	const base = uuidv4();
	return `${base}${ext.toLowerCase()}`;
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const logId = Number(params.logId);
	if (Number.isNaN(logId)) {
		return json({ error: 'Invalid log ID', code: 'VALIDATION_ERROR' }, { status: 400 });
	}
	const log = await maintenanceLogRepository.getById(locals.db, logId);
	if (!log) {
		return json({ error: 'Maintenance log not found', code: 'NOT_FOUND' }, { status: 404 });
	}
	const attachments = await maintenanceLogAttachmentRepository.getByLogId(locals.db, logId);
	return json(attachments);
};

export const POST: RequestHandler = async ({ request, params, locals }) => {
	const logId = Number(params.logId);
	if (Number.isNaN(logId)) {
		return json({ error: 'Invalid log ID', code: 'VALIDATION_ERROR' }, { status: 400 });
	}
	const log = await maintenanceLogRepository.getById(locals.db, logId);
	if (!log) {
		return json({ error: 'Maintenance log not found', code: 'NOT_FOUND' }, { status: 404 });
	}

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return json({ error: 'Invalid multipart body', code: 'VALIDATION_ERROR' }, { status: 400 });
	}

	const file = formData.get('file');
	if (!file || !(file instanceof File)) {
		return json({ error: 'No file provided', code: 'VALIDATION_ERROR' }, { status: 400 });
	}

	const config = getConfig();
	const maxBytes = config.UPLOAD_MAX_SIZE_MB * 1024 * 1024;
	if (file.size > maxBytes) {
		return json(
			{
				error: `File exceeds maximum size of ${config.UPLOAD_MAX_SIZE_MB} MB`,
				code: 'FILE_TOO_LARGE'
			},
			{ status: 400 }
		);
	}

	const mime = file.type || 'application/octet-stream';
	if (!isAllowedMime(mime)) {
		return json(
			{ error: 'File type not allowed. Use images or PDF.', code: 'INVALID_FILE_TYPE' },
			{ status: 400 }
		);
	}

	const uploadDir = getUploadDir(config);
	await mkdir(uploadDir, { recursive: true });
	const storedFilename = safeFilename(file.name);
	const fullPath = join(uploadDir, storedFilename);
	const buffer = Buffer.from(await file.arrayBuffer());
	await writeFile(fullPath, buffer);

	const attachment = await maintenanceLogAttachmentRepository.create(locals.db, {
		maintenance_log_id: logId,
		filename: storedFilename,
		original_filename: file.name,
		mime_type: mime,
		file_size: file.size,
		file_path: storedFilename
	});

	return json(attachment, { status: 201 });
};
