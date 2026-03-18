import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLatestProactiveResults, dismissProactiveSuggestion } from '$lib/agent/proactive.js';

export const GET: RequestHandler = async ({ locals }) => {
	const rows = await getLatestProactiveResults(locals.db);
	if (!rows) {
		return new Response(null, { status: 404 });
	}
	return json(rows);
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
	try {
		const body = (await request.json()) as { id: number };
		const { id } = body;

		if (typeof id !== 'number' || !Number.isInteger(id)) {
			return json(
				{ success: false, error: 'Valid id (integer) is required', code: 'VALIDATION_ERROR' },
				{ status: 400 }
			);
		}

		const updated = await dismissProactiveSuggestion(locals.db, id);
		if (!updated) {
			return json(
				{ success: false, error: 'Suggestion not found', code: 'NOT_FOUND' },
				{ status: 404 }
			);
		}

		return json({ success: true });
	} catch (error) {
		console.error('Suggestions PATCH error:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				code: 'INTERNAL_ERROR'
			},
			{ status: 500 }
		);
	}
};
