import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { globalSettingsRepository } from '$lib/repositories.js';

// GET /api/settings/[key] - Get a specific setting
export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const { key } = params;
		
		if (!key) {
			return error(400, 'Setting key is required');
		}

		const setting = await globalSettingsRepository.getByKey(locals.db, key);
		
		if (!setting) {
			return error(404, 'Setting not found');
		}

		return json({
			key: setting.setting_key,
			value: setting.setting_value,
			data_type: setting.data_type,
			description: setting.description,
			default_value: setting.default_value,
			min_value: setting.min_value,
			max_value: setting.max_value
		});
	} catch (err) {
		console.error('Error fetching setting:', err);
		return error(500, 'Failed to fetch setting');
	}
};

// PUT /api/settings/[key] - Update a specific setting
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	try {
		const { key } = params;
		
		if (!key) {
			return error(400, 'Setting key is required');
		}

		const body = await request.json();
		const { value } = body;

		if (value === undefined || value === null) {
			return error(400, 'Setting value is required');
		}

		// Validate the setting
		const validation = await globalSettingsRepository.validateSetting(locals.db, key, String(value));
		
		if (!validation.valid) {
			return error(400, validation.error || 'Invalid value');
		}

		// Update the setting
		const updatedSetting = await globalSettingsRepository.updateByKey(locals.db, key, String(value));
		
		if (!updatedSetting) {
			return error(404, 'Setting not found');
		}

		return json({
			key: updatedSetting.setting_key,
			value: updatedSetting.setting_value,
			data_type: updatedSetting.data_type,
			description: updatedSetting.description,
			updated_at: updatedSetting.updated_at
		});
	} catch (err) {
		console.error('Error updating setting:', err);
		return error(500, 'Failed to update setting');
	}
};