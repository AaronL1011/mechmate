import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { equipmentResourceRepository } from '$lib/repositories.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getUploadDir } from '$lib/config.js';

export const GET: RequestHandler = async ({ params, locals }) => {
	const equipmentId = Number(params.id);
	const resourceId = Number(params.resourceId);
	if (Number.isNaN(equipmentId) || Number.isNaN(resourceId)) {
		error(400, 'Invalid ID');
	}
	const resource = await equipmentResourceRepository.getByIdForEquipment(
		locals.db,
		equipmentId,
		resourceId
	);
	if (!resource) {
		error(404, 'Resource not found');
	}

	const fullPath = join(getUploadDir(), resource.file_path);
	let buffer: Buffer;
	try {
		buffer = await readFile(fullPath);
	} catch {
		error(404, 'File not found on disk');
	}

	const filename = resource.original_filename.replace(/[^\w.\- ()[\]]+/g, '_');
	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': resource.mime_type || 'application/octet-stream',
			'Content-Disposition': `inline; filename="${filename}"`,
			'Content-Length': String(buffer.length)
		}
	});
};
