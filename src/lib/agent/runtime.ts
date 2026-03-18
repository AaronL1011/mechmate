import type { Kysely } from 'kysely';
import type { Database } from '$lib/types/db.js';
import type { LLMMessage } from '$lib/services/llm.js';
import type { LLMResponseFormat } from '$lib/services/llm.js';
import { llmService } from '$lib/services/llm.js';
import { getToolDefinitionsForLLM, isQueryTool } from './tools.js';
import type { FunctionExecutor, ActionResult } from './executor.js';

function toLLMResponseFormat(format: ResponseOutputFormat): LLMResponseFormat {
	if (format.type === 'json_object') return { type: 'json_object' };
	return {
		type: 'json_schema',
		json_schema: format.schema
	};
}

export type ResponseOutputFormat =
	| { type: 'json_object' }
	| {
			type: 'json_schema';
			schema: {
				name: string;
				strict?: boolean;
				schema: {
					type: 'object';
					properties: Record<string, unknown>;
					required?: string[];
					additionalProperties?: boolean;
				};
			};
	  };

export interface RunAgentTurnOptions {
	queryOnly?: boolean;
	maxIterations?: number;
	responseFormat?: ResponseOutputFormat;
}

export interface RunAgentTurnResult {
	message?: string;
	structuredMessage?: unknown;
	conversationHistory?: LLMMessage[];
	actionsForConfirmation?: ActionResult[];
	error?: string;
	requiresMoreInfo?: boolean;
}

export async function runAgentTurn(
	db: Kysely<Database>,
	messages: LLMMessage[],
	executor: FunctionExecutor,
	systemPrompt: string,
	options: RunAgentTurnOptions = {}
): Promise<RunAgentTurnResult> {
	const { queryOnly = false, maxIterations = 5, responseFormat } = options;
	const tools = getToolDefinitionsForLLM(queryOnly);
	const llmTools = tools.map((func) => ({ type: 'function' as const, function: func }));

	let iteration = 0;
	let currentMessages = [...messages];

	while (iteration < maxIterations) {
		iteration++;

		const llmResponse = await llmService.completions({
			messages: currentMessages,
			tools: llmTools,
			tool_choice: 'auto',
			...(responseFormat && { response_format: toLLMResponseFormat(responseFormat) })
		});

		const choice = llmResponse.choices[0];
		if (!choice?.message) {
			return {
				error: 'Invalid response from LLM',
				conversationHistory: currentMessages
			};
		}

		currentMessages.push(choice.message);

		if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
			for (const toolCall of choice.message.tool_calls) {
				const functionName = toolCall.function.name;
				const functionArgs = JSON.parse(toolCall.function.arguments || '{}');

				const actionResult = await executor.executeFunction(functionName, functionArgs);

				if (isQueryTool(functionName)) {
					if (queryOnly && actionResult.requires_confirmation) {
						return {
							error: 'Proactive run must use query tools only; action tool was returned.',
							conversationHistory: currentMessages
						};
					}
					currentMessages.push({
						role: 'tool',
						content: JSON.stringify(
							actionResult.result ?? actionResult.error ?? 'No result'
						),
						tool_call_id: toolCall.id
					});
					continue;
				}

				if (actionResult.error) {
					return {
						error: actionResult.error,
						conversationHistory: currentMessages
					};
				}

				if (actionResult.requires_confirmation) {
					return {
						actionsForConfirmation: [actionResult],
						conversationHistory: currentMessages
					};
				}
			}
			continue;
		}

		const rawContent =
			choice.message.content ||
			'I need more information to help you with that request.';

		let structuredMessage: unknown | undefined;
		if (responseFormat && rawContent) {
			try {
				structuredMessage = JSON.parse(rawContent) as unknown;
			} catch {
				structuredMessage = undefined;
			}
		}

		return {
			message: rawContent,
			...(structuredMessage !== undefined && { structuredMessage }),
			conversationHistory: currentMessages
		};
	}

	return {
		message:
			'I need more information to complete this request. Please provide more details or try a more specific request.',
		conversationHistory: currentMessages,
		requiresMoreInfo: true
	};
}
