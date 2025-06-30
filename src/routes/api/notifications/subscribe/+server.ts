import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { notificationSubscriptionRepository } from '$lib/repositories.js';
import type { PushSubscriptionData } from '$lib/types/db.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const subscriptionData: PushSubscriptionData = await request.json();

		// Validate required fields
		if (!subscriptionData.endpoint || !subscriptionData.keys?.p256dh || !subscriptionData.keys?.auth) {
			return json({ error: 'Invalid subscription data' }, { status: 400 });
		}

		// Check if subscription already exists
		const existingSubscription = await notificationSubscriptionRepository.getByEndpoint(
			locals.db,
			subscriptionData.endpoint
		);

		if (existingSubscription) {
			// Update last used timestamp
			await notificationSubscriptionRepository.updateLastUsed(locals.db, existingSubscription.id);
			return json({ success: true, subscription: existingSubscription });
		}

		// Create new subscription
		const subscription = await notificationSubscriptionRepository.create(locals.db, subscriptionData);

		return json({ success: true, subscription });
	} catch (error) {
		console.error('Error creating notification subscription:', error);
		return json({ error: 'Failed to create subscription' }, { status: 500 });
	}
};