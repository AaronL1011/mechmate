import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { globalSettingsRepository } from '$lib/repositories.js';

// GET /api/settings - Get all global settings
export const GET: RequestHandler = async ({ locals }) => {
	try {
		const settings = await globalSettingsRepository.getAllAsObject(locals.db);
		return json(settings);
	} catch (err) {
		console.error('Error fetching global settings:', err);
		return error(500, 'Failed to fetch settings');
	}
};

// POST /api/settings - Update multiple settings
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const updates = await request.json();
		
		if (!updates || typeof updates !== 'object') {
			return error(400, 'Invalid request body');
		}

		const results: Record<string, any> = {};
		const errors: Record<string, string> = {};

		// Process each setting update
		for (const [key, value] of Object.entries(updates)) {
			try {
				// Validate the setting
				const validation = await globalSettingsRepository.validateSetting(locals.db, key, String(value));
				
				if (!validation.valid) {
					errors[key] = validation.error || 'Invalid value';
					continue;
				}

				// Update the setting
				const updatedSetting = await globalSettingsRepository.updateByKey(locals.db, key, String(value));
				
				if (updatedSetting) {
					results[key] = {
						success: true,
						value: updatedSetting.setting_value
					};
				} else {
					errors[key] = 'Setting not found';
				}
			} catch (err) {
				console.error(`Error updating setting ${key}:`, err);
				errors[key] = 'Update failed';
			}
		}

		// Return results with any errors
		const response = {
			updated: results,
			errors: Object.keys(errors).length > 0 ? errors : undefined
		};

		// If all updates failed, return 400
		if (Object.keys(results).length === 0 && Object.keys(errors).length > 0) {
			return error(400, { message: 'No settings were updated'});
		}

		return json(response);
	} catch (err) {
		console.error('Error updating global settings:', err);
		return error(500, 'Failed to update settings');
	}
};