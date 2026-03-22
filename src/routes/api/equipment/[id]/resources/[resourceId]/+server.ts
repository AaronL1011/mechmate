import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { equipmentRepository, equipmentResourceRepository } from '$lib/repositories.js';
import type { EquipmentResourceUpdate, PatchEquipmentResourceRequest } from '$lib/types/db.js';
import { parseResourceKind } from '$lib/equipment-resource-upload.js';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { getUploadDir } from '$lib/config.js';
import { toEquipmentResourceClient } from '$lib/equipment-resource-serialize.js';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
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

	let body: PatchEquipmentResourceRequest;
	try {
		body = (await request.json()) as PatchEquipmentResourceRequest;
	} catch {
		return json({ error: 'Invalid JSON body', code: 'VALIDATION_ERROR' }, { status: 400 });
	}

	const patch: EquipmentResourceUpdate = {};
	if (body.title !== undefined) {
		patch.title =
			body.title === null || body.title === '' ? null : String(body.title).trim() || null;
	}
	if (body.resource_kind !== undefined) {
		patch.resource_kind = parseResourceKind(String(body.resource_kind));
	}
	if (body.notes !== undefined) {
		patch.notes =
			body.notes === null || body.notes === '' ? null : String(body.notes).trim() || null;
	}

	if (Object.keys(patch).length === 0) {
		return json({ error: 'No valid fields to update', code: 'VALIDATION_ERROR' }, { status: 400 });
	}

	const updated = await equipmentResourceRepository.update(locals.db, resourceId, patch);
	if (!updated) {
		return json({ error: 'Update failed', code: 'SERVER_ERROR' }, { status: 500 });
	}
	return json(toEquipmentResourceClient(updated));
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const equipmentId = Number(params.id);
	const resourceId = Number(params.resourceId);
	if (Number.isNaN(equipmentId) || Number.isNaN(resourceId)) {
		return json({ error: 'Invalid ID', code: 'VALIDATION_ERROR' }, { status: 400 });
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
	try {
		await unlink(fullPath);
	} catch {
		// best effort
	}

	const ok = await equipmentResourceRepository.delete(locals.db, resourceId);
	if (!ok) {
		return json({ error: 'Delete failed', code: 'SERVER_ERROR' }, { status: 500 });
	}
	return json({ success: true });
};
