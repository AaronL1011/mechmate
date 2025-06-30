import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { notificationSubscriptionRepository } from '$lib/repositories.js';

export const DELETE: RequestHandler = async ({ request, locals }) => {
	try {
		const { endpoint } = await request.json();

		if (!endpoint) {
			return json({ error: 'Endpoint is required' }, { status: 400 });
		}

		// Delete subscription by endpoint
		const deleted = await notificationSubscriptionRepository.deleteByEndpoint(locals.db, endpoint);

		if (!deleted) {
			return json({ error: 'Subscription not found' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting notification subscription:', error);
		return json({ error: 'Failed to delete subscription' }, { status: 500 });
	}
};