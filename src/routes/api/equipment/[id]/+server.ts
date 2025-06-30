import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { equipmentRepository } from '$lib/repositories.js';
import type { UpdateEquipmentRequest } from '$lib/types/db.js';

export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    if (!params.id) {
      return json({ error: 'Equipment ID is required' }, { status: 400 });
    }
    
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return json({ error: 'Invalid equipment ID' }, { status: 400 });
    }
    
    const equipment = await equipmentRepository.getById(locals.db, id);
    if (!equipment) {
      return json({ error: 'Equipment not found' }, { status: 404 });
    }
    
    return json(equipment);
  } catch (error) {
    console.error('Error fetching equipment:', error);
    return json({ error: 'Failed to fetch equipment' }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  try {
    if (!params.id) {
      return json({ error: 'Equipment ID is required' }, { status: 400 });
    }
    
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return json({ error: 'Invalid equipment ID' }, { status: 400 });
    }
    
    const body = await request.json() as UpdateEquipmentRequest;
    
    // Check if equipment exists
    const existing = await equipmentRepository.getById(locals.db, id);
    if (!existing) {
      return json({ error: 'Equipment not found' }, { status: 404 });
    }
    
    // Basic validation
    if (body.current_usage_value !== undefined && body.current_usage_value < 0) {
      return json({ error: 'Current usage value must be non-negative' }, { status: 400 });
    }
    
    const equipment = await equipmentRepository.update(locals.db, id, body);
    return json(equipment);
  } catch (error) {
    console.error('Error updating equipment:', error);
    return json({ error: 'Failed to update equipment' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    if (!params.id) {
      return json({ error: 'Equipment ID is required' }, { status: 400 });
    }
    
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return json({ error: 'Invalid equipment ID' }, { status: 400 });
    }
    
    const success = await equipmentRepository.delete(locals.db, id);
    if (!success) {
      return json({ error: 'Equipment not found' }, { status: 404 });
    }
    
    return json({ message: 'Equipment deleted successfully' });
  } catch (error) {
    console.error('Error deleting equipment:', error);
    return json({ error: 'Failed to delete equipment' }, { status: 500 });
  }
}; 