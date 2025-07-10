import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { NotificationService } from '$lib/utils/notifications.js';

export const POST: RequestHandler = async ({ locals }) => {
	try {
		const notificationService = new NotificationService(locals.db);
		const sentCount = await notificationService.sendTestNotification();

		return json({
			success: true,
			message: `Test notification sent to ${sentCount} device(s)`,
			sentCount
		});
	} catch (error) {
		console.error('Error sending test notification:', error);
		return json({ error: 'Failed to send test notification' }, { status: 500 });
	}
};
