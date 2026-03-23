import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getLatestProactiveResults,
	dismissProactiveSuggestion,
	runProactiveAgent
} from '$lib/agent/proactive.js';
import { getAssistantToneContext } from '$lib/agent/prompts.js';
import { globalSettingsRepository } from '$lib/repositories.js';
import { llmService } from '$lib/services/llm.js';
import type { GlobalSettingsValues } from '$lib/types/db.js';

export const GET: RequestHandler = async ({ locals }) => {
	const rows = await getLatestProactiveResults(locals.db);
	if (!rows) {
		return new Response(null, { status: 404 });
	}
	return json(rows);
};

export const POST: RequestHandler = async ({ locals }) => {
	try {
		if (!llmService.isConfigured()) {
			return json(
				{
					success: false,
					error: 'LLM service is not configured. Please check environment variables.',
					code: 'LLM_NOT_CONFIGURED'
				},
				{ status: 500 }
			);
		}

		const tone = (await globalSettingsRepository.getTypedValue(
			locals.db,
			'assistant_tone',
			'professional'
		)) as GlobalSettingsValues['assistant_tone'];
		const toneContext = getAssistantToneContext(tone);
		const result = await runProactiveAgent(locals.db, {
			toneContext,
			skipChangeCheck: true
		});

		return json({
			success: true,
			...(result == null
				? { message: 'No new suggestions generated; data may be unchanged.' }
				: {})
		});
	} catch (error) {
		console.error('Suggestions POST error:', error);
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
