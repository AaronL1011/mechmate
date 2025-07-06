import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { notificationSubscriptionRepository } from '$lib/repositories.js';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		if (!params.id) {
			return json({ error: 'Missing ID' }, { status: 400 });
		}
		const subscriptionId = parseInt(params.id);

		if (isNaN(subscriptionId)) {
			return json({ error: 'Invalid subscription ID' }, { status: 400 });
		}

		// Delete subscription by ID
		const deleted = await notificationSubscriptionRepository.delete(locals.db, subscriptionId);

		if (!deleted) {
			return json({ error: 'Subscription not found' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting notification subscription:', error);
		return json({ error: 'Failed to delete subscription' }, { status: 500 });
	}
};