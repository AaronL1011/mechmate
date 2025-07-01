import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { taskRepository, taskTypeRepository } from '$lib/repositories.js';
import type { CreateTaskRequest } from '$lib/types/db.js';

export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    const type = url.searchParams.get('type');
    
    if (type === 'upcoming') {
      const tasks = await taskRepository.getUpcoming(locals.db);
      return json(tasks);
    }
    
    if (type === 'overdue') {
      const tasks = await taskRepository.getOverdue(locals.db);
      return json(tasks);
    }
    
    const tasks = await taskRepository.getAll(locals.db);
    return json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const body = await request.json() as CreateTaskRequest;
    
    // Basic validation
    if (!body.equipment_id || !body.task_type_id || !body.title) {
      return json({ error: 'Equipment ID, task type ID, and title are required' }, { status: 400 });
    }
    
    if (body.usage_interval !== undefined && body.usage_interval <= 0) {
      return json({ error: 'Usage interval must be positive' }, { status: 400 });
    }
    
    if (body.time_interval_days !== undefined && body.time_interval_days <= 0) {
      return json({ error: 'Time interval must be positive' }, { status: 400 });
    }
    
    const task = await taskRepository.create(locals.db, body);
    return json(task, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return json({ error: 'Failed to create task' }, { status: 500 });
  }
}; 