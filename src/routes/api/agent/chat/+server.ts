import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { llmService, type LLMMessage } from '$lib/services/llm.js';
import { FunctionExecutor } from '$lib/agent/executor.js';
import { runAgentTurn } from '$lib/agent/runtime.js';
import { getInteractiveSystemPrompt, getAssistantToneContext } from '$lib/agent/prompts.js';
import * as pendingActions from '$lib/agent/pending-actions.js';
import * as sessionStore from '$lib/agent/session.js';
import {
	equipmentRepository,
	equipmentResourceRepository,
	globalSettingsRepository
} from '$lib/repositories.js';
import { toEquipmentResourceClient } from '$lib/equipment-resource-serialize.js';
import type { GlobalSettingsValues } from '$lib/types/db.js';
import { v4 as uuidv4 } from 'uuid';

interface AgentChatRequest {
	prompt: string;
	context?: string;
	conversation_history?: LLMMessage[];
	session_id?: string;
	focused_equipment_id?: number;
}

export const POST: RequestHandler = async ({ request, locals }) => {
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

		const body = (await request.json()) as AgentChatRequest;
		const { prompt, context, session_id: requestSessionId, focused_equipment_id } = body;

		if (!prompt?.trim()) {
			return json(
				{ success: false, error: 'Prompt is required', code: 'VALIDATION_ERROR' },
				{ status: 400 }
			);
		}

		const sessionId = await sessionStore.ensureSession(locals.db, requestSessionId);
		const conversation_history: LLMMessage[] =
			requestSessionId && sessionId === requestSessionId
				? await sessionStore.getLastTurns(locals.db, sessionId)
				: (body.conversation_history ?? []);

		const executor = new FunctionExecutor({ db: locals.db });
		const contextData: Record<string, unknown> = {};

		try {
			const [equipmentTypes, taskTypes, unitSetting, toneSetting] = await Promise.all([
				executor.executeFunction('get_equipment_types', {}),
				executor.executeFunction('get_task_types', {}),
				globalSettingsRepository.getTypedValue(locals.db, 'preferred_measurement_system', 'metric'),
				globalSettingsRepository.getTypedValue(
					locals.db,
					'assistant_tone',
					'professional'
				) as Promise<GlobalSettingsValues['assistant_tone']>
			]);

			contextData.preferred_measurement_system = unitSetting;
			contextData.assistant_tone = getAssistantToneContext(toneSetting);
			if (equipmentTypes.result) contextData.available_equipment_types = equipmentTypes.result;
			if (taskTypes.result) contextData.available_task_types = taskTypes.result;
		} catch (err) {
			console.warn('Failed to load reference data:', err);
		}

		if (context) contextData.user_context = context;

		if (
			focused_equipment_id !== undefined &&
			focused_equipment_id !== null &&
			Number.isFinite(focused_equipment_id)
		) {
			const eqId = Math.floor(Number(focused_equipment_id));
			try {
				const eq = await equipmentRepository.getById(locals.db, eqId);
				if (eq) {
					const resourceRows = await equipmentResourceRepository.getByEquipmentId(locals.db, eqId);
					contextData.focused_equipment = {
						id: eq.id,
						name: eq.name,
						make: eq.make,
						model: eq.model,
						usage_unit: eq.usage_unit
					};
					contextData.focused_equipment_resources = resourceRows.map(toEquipmentResourceClient);
				}
			} catch (err) {
				console.warn('Failed to load focused equipment resources:', err);
			}
		}

		const systemPrompt = getInteractiveSystemPrompt(contextData.assistant_tone as string);
		const messages: LLMMessage[] = [
			{ role: 'system', content: systemPrompt },
			...(Object.keys(contextData).length > 0
				? [
						{
							role: 'system' as const,
							content: `Available reference data: ${JSON.stringify(contextData, null, 2)}`
						}
					]
				: []),
			...conversation_history,
			{ role: 'user', content: prompt }
		];

		const result = await runAgentTurn(locals.db, messages, executor, systemPrompt, {
			maxIterations: 5
		});

		if (result.error) {
			return json(
				{
					success: false,
					error: result.error,
					conversation_history: result.conversationHistory,
					session_id: sessionId,
					code: 'AGENT_ERROR'
				},
				{ status: 400 }
			);
		}

		const newTurns = result.conversationHistory?.slice(messages.length - 1) ?? [];
		for (const msg of newTurns) {
			const content = typeof msg.content === 'string' ? msg.content : '';
			await sessionStore.appendTurn(
				locals.db,
				sessionId,
				msg.role,
				content,
				msg.tool_calls ?? undefined,
				msg.tool_call_id ?? null
			);
		}

		if (result.actionsForConfirmation?.length) {
			const action = result.actionsForConfirmation[0];
			const actionId = uuidv4();

			// Assistant messages with tool_calls must be followed by matching tool messages
			// before the next user turn, or follow-up chat requests can fail validation.
			const lastAssistantWithTools = [...newTurns]
				.reverse()
				.find((m) => m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0);
			if (lastAssistantWithTools?.tool_calls) {
				const pendingPayload = {
					pending_user_confirmation: true as const,
					action_id: actionId,
					entity: action.entity,
					action_type: action.type
				};
				for (const tc of lastAssistantWithTools.tool_calls) {
					await sessionStore.appendTurn(
						locals.db,
						sessionId,
						'tool',
						JSON.stringify(pendingPayload),
						undefined,
						tc.id
					);
				}
			}

			const pendingTtlMs = action.entity === 'task_batch' ? 10 * 60 * 1000 : undefined;
			await pendingActions.createPendingAction(
				locals.db,
				actionId,
				action,
				sessionId,
				pendingTtlMs
			);
			return json({
				success: true,
				action,
				action_id: actionId,
				conversation_history: result.conversationHistory,
				session_id: sessionId
			});
		}

		return json({
			success: true,
			message: result.message,
			conversation_history: result.conversationHistory,
			requires_more_info: result.requiresMoreInfo,
			session_id: sessionId
		});
	} catch (error) {
		console.error('Agent chat API error:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
				code: 'INTERNAL_ERROR'
			},
			{ status: 500 }
		);
	}
};
