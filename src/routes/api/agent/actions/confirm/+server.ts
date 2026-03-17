import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as pendingActions from '$lib/agent/pending-actions.js';
import { executeConfirmedAction, getSuccessMessage } from '$lib/agent/execute-action.js';

interface ConfirmRequest {
	action_id: string;
	confirmed: boolean;
	updated_data?: Record<string, unknown>;
	user_feedback?: string;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = (await request.json()) as ConfirmRequest;
		const { action_id, confirmed, updated_data } = body;

		if (!action_id) {
			return json(
				{ success: false, error: 'Action ID is required', code: 'VALIDATION_ERROR' },
				{ status: 400 }
			);
		}

		const entry = await pendingActions.getPendingAction(locals.db, action_id);

		if (!entry) {
			return json(
				{ success: false, error: 'Action not found or expired', code: 'NOT_FOUND' },
				{ status: 404 }
			);
		}

		if (new Date(entry.expiresAt) < new Date()) {
			await pendingActions.resolvePendingAction(locals.db, action_id, 'cancelled');
			return json(
				{ success: false, error: 'Action has expired', code: 'EXPIRED' },
				{ status: 410 }
			);
		}

		if (!confirmed) {
			await pendingActions.resolvePendingAction(locals.db, action_id, 'cancelled');
			return json({ success: true, message: 'Action cancelled' });
		}

		const action = entry.action;
		if (updated_data && action.data) {
			action.data = { ...action.data, ...updated_data };
		}

		const result = await executeConfirmedAction(locals.db, action);
		await pendingActions.resolvePendingAction(locals.db, action_id, 'executed');

		return json({
			success: true,
			result,
			message: getSuccessMessage(action)
		});
	} catch (error) {
		console.error('Agent confirm API error:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Action execution failed',
				code: 'EXECUTION_ERROR'
			},
			{ status: 500 }
		);
	}
};
