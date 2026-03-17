import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLatestProactiveResult } from '$lib/agent/proactive.js';

export const GET: RequestHandler = async ({ locals }) => {
	const row = await getLatestProactiveResult(locals.db);
	if (!row) {
		return new Response(null, { status: 404 });
	}
	return json({
		result: row.result,
		created_at: row.created_at
	});
};
