import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { equipmentRepository } from '$lib/repositories.js';
import type { CreateEquipmentRequest, UpdateEquipmentRequest } from '$lib/types/db.js';

export const GET: RequestHandler = async ({ locals }) => {
  try {
    const equipment = await equipmentRepository.getAll(locals.db);
    return json(equipment);
  } catch (error) {
    console.error('Error fetching equipment:', error);
    return json({ error: 'Failed to fetch equipment' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const body = await request.json() as CreateEquipmentRequest;
    
    // Basic validation
    if (!body.name || isNaN(body.equipment_type_id) || !body.usage_unit) {
      return json({ error: 'Name, type, and usage unit are required' }, { status: 400 });
    }
    
    if (body.current_usage_value < 0) {
      return json({ error: 'Current usage value must be non-negative' }, { status: 400 });
    }
    
    const equipment = await equipmentRepository.create(locals.db, body);
    return json(equipment, { status: 201 });
  } catch (error) {
    console.error('Error creating equipment:', error);
    return json({ error: 'Failed to create equipment' }, { status: 500 });
  }
}; 