import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { notificationSettingsRepository, notificationSubscriptionRepository } from '$lib/repositories.js';
import type { NotificationSettingsRequest } from '$lib/types/db.js';
import { getVapidKeys } from '$lib/utils/notifications.js';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const settings = await notificationSettingsRepository.get(locals.db);
		const subscriptions = await notificationSubscriptionRepository.getAll(locals.db);
		const vapidKeys = getVapidKeys();

		return json({
			settings,
			subscriptions: subscriptions.map(sub => ({
				id: sub.id,
				endpoint: sub.endpoint,
				user_agent: sub.user_agent,
				created_at: sub.created_at,
				last_used_at: sub.last_used_at
			})),
			vapidPublicKey: vapidKeys.publicKey
		});
	} catch (error) {
		console.error('Error fetching notification settings:', error);
		return json({ error: 'Failed to fetch settings' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	try {
		const settingsData: NotificationSettingsRequest = await request.json();

		// Validate required fields
		if (typeof settingsData.enabled !== 'boolean') {
			return json({ error: 'Invalid settings data' }, { status: 400 });
		}

		// Update settings
		const updatedSettings = await notificationSettingsRepository.update(locals.db, settingsData);

		return json({ success: true, settings: updatedSettings });
	} catch (error) {
		console.error('Error updating notification settings:', error);
		return json({ error: 'Failed to update settings' }, { status: 500 });
	}
};