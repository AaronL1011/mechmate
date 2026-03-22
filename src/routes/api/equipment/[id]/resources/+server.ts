import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getResourceUploadMaxBytes, getUploadDir } from '$lib/config.js';
import { equipmentRepository, equipmentResourceRepository } from '$lib/repositories.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import {
	isAllowedEquipmentResourceMime,
	parseResourceKind,
	safeResourceFilename
} from '$lib/equipment-resource-upload.js';
import { extractTextFromBuffer } from '$lib/services/resource-extraction.js';
import { toEquipmentResourceClient } from '$lib/equipment-resource-serialize.js';

export const GET: RequestHandler = async ({ params, locals }) => {
	const equipmentId = Number(params.id);
	if (Number.isNaN(equipmentId)) {
		return json({ error: 'Invalid equipment ID', code: 'VALIDATION_ERROR' }, { status: 400 });
	}
	const equipment = await equipmentRepository.getById(locals.db, equipmentId);
	if (!equipment) {
		return json({ error: 'Equipment not found', code: 'NOT_FOUND' }, { status: 404 });
	}
	const rows = await equipmentResourceRepository.getByEquipmentId(locals.db, equipmentId);
	return json(rows.map(toEquipmentResourceClient));
};

export const POST: RequestHandler = async ({ request, params, locals }) => {
	const equipmentId = Number(params.id);
	if (Number.isNaN(equipmentId)) {
		return json({ error: 'Invalid equipment ID', code: 'VALIDATION_ERROR' }, { status: 400 });
	}
	const equipment = await equipmentRepository.getById(locals.db, equipmentId);
	if (!equipment) {
		return json({ error: 'Equipment not found', code: 'NOT_FOUND' }, { status: 404 });
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

	const maxBytes = getResourceUploadMaxBytes();
	if (file.size > maxBytes) {
		return json(
			{
				error: `File exceeds maximum size for equipment resources`,
				code: 'FILE_TOO_LARGE'
			},
			{ status: 400 }
		);
	}

	const mime = file.type || 'application/octet-stream';
	if (!isAllowedEquipmentResourceMime(mime)) {
		return json(
			{
				error: 'File type not allowed. Use PDF, Word, plain text, Markdown, CSV, or RTF.',
				code: 'INVALID_FILE_TYPE'
			},
			{ status: 400 }
		);
	}

	const titleField = formData.get('title');
	const kindField = formData.get('resource_kind');
	const title = typeof titleField === 'string' && titleField.trim() ? titleField.trim() : null;
	const resource_kind = parseResourceKind(typeof kindField === 'string' ? kindField : undefined);

	const uploadDir = getUploadDir();
	await mkdir(uploadDir, { recursive: true });
	const storedFilename = safeResourceFilename(file.name);
	const fullPath = join(uploadDir, storedFilename);
	const buffer = Buffer.from(await file.arrayBuffer());

	let extraction;
	try {
		extraction = await extractTextFromBuffer(buffer, mime);
	} catch {
		extraction = {
			status: 'failed' as const,
			text: null,
			text_truncated: false
		};
	}

	try {
		await writeFile(fullPath, buffer);
	} catch (e) {
		console.error('Failed to write equipment resource file', e);
		return json({ error: 'Failed to save file', code: 'STORAGE_ERROR' }, { status: 500 });
	}

	const row = await equipmentResourceRepository.create(locals.db, {
		equipment_id: equipmentId,
		filename: storedFilename,
		original_filename: file.name,
		mime_type: mime,
		file_size: file.size,
		file_path: storedFilename,
		resource_kind,
		title,
		notes: null,
		extraction_status: extraction.status,
		extracted_text: extraction.text,
		text_truncated: extraction.text_truncated ? 1 : 0
	});

	return json(toEquipmentResourceClient(row), { status: 201 });
};
