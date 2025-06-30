import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { equipmentTypeRepository } from '$lib/repositories.js';
import type { CreateEquipmentTypeRequest } from '$lib/types/db';

export const GET: RequestHandler = async ({ locals }) => {
  try {
    const equipmentTypes = await equipmentTypeRepository.getAll(locals.db);
    return json(equipmentTypes);
  } catch (error) {
    console.error('Error fetching equipment types:', error);
    return json({ error: 'Failed to fetch equipment types' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const body = await request.json() as CreateEquipmentTypeRequest;

    if (!body.name) {
      return json({ error: 'A name is required' }, { status: 400 });
    }

    const equipmentType = await equipmentTypeRepository.create(locals.db, body);
    return json(equipmentType);
  } catch (error) {
    console.error('Error creating equipment type:', error);
    return json({ error: 'Failed to create equipment types' }, { status: 500 });
  }
};
