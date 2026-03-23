import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { equipmentRepository, equipmentResourceRepository } from '$lib/repositories.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getUploadDir } from '$lib/config.js';
import { extractTextFromBuffer } from '$lib/services/resource-extraction.js';
import { toEquipmentResourceClient } from '$lib/equipment-resource-serialize.js';

export const POST: RequestHandler = async ({ params, locals }) => {
	const equipmentId = Number(params.id);
	const resourceId = Number(params.resourceId);
	if (Number.isNaN(equipmentId) || Number.isNaN(resourceId)) {
		return json({ error: 'Invalid ID', code: 'VALIDATION_ERROR' }, { status: 400 });
	}
	const equipment = await equipmentRepository.getById(locals.db, equipmentId);
	if (!equipment) {
		return json({ error: 'Equipment not found', code: 'NOT_FOUND' }, { status: 404 });
	}
	const existing = await equipmentResourceRepository.getByIdForEquipment(
		locals.db,
		equipmentId,
		resourceId
	);
	if (!existing) {
		return json({ error: 'Resource not found', code: 'NOT_FOUND' }, { status: 404 });
	}

	const fullPath = join(getUploadDir(), existing.file_path);
	let buffer: Buffer;
	try {
		buffer = await readFile(fullPath);
	} catch {
		return json({ error: 'File not found on disk', code: 'NOT_FOUND' }, { status: 404 });
	}

	await equipmentResourceRepository.update(locals.db, resourceId, {
		extraction_status: 'pending',
		extracted_text: null,
		text_truncated: 0
	});

	let extraction;
	try {
		extraction = await extractTextFromBuffer(buffer, existing.mime_type);
	} catch {
		extraction = {
			status: 'failed' as const,
			text: null,
			text_truncated: false
		};
	}

	const updated = await equipmentResourceRepository.update(locals.db, resourceId, {
		extraction_status: extraction.status,
		extracted_text: extraction.text,
		text_truncated: extraction.text_truncated ? 1 : 0
	});

	if (!updated) {
		return json({ error: 'Update failed', code: 'SERVER_ERROR' }, { status: 500 });
	}
	return json(toEquipmentResourceClient(updated));
};
