import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { NotificationService } from '$lib/utils/notifications.js';

// Internal endpoint for background job checking
export const POST: RequestHandler = async ({ locals }) => {
	try {
		const notificationService = new NotificationService(locals.db);
		await notificationService.checkAndSendDueNotifications();

		return json({ success: true, message: 'Notification check completed' });
	} catch (error) {
		console.error('Error checking notifications:', error);
		return json({ error: 'Failed to check notifications' }, { status: 500 });
	}
};