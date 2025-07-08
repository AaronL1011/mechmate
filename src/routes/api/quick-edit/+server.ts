import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { llmService, type LLMMessage } from '$lib/services/llm.js';
import { FunctionExecutor, allFunctions, type ActionResult } from '$lib/services/functions.js';
import { v4 as uuidv4 } from 'uuid';
import { globalSettingsRepository } from '$lib/repositories';
import type { GlobalSettingsValues } from '$lib/types/db';

interface QuickEditRequest {
	prompt: string;
	context?: string;
	conversation_history?: LLMMessage[];
}

interface QuickEditResponse {
	success: boolean;
	action?: ActionResult;
	action_id?: string;
	message?: string;
	error?: string;
	conversation_history?: LLMMessage[];
	requires_more_info?: boolean;
}

// Store pending actions in memory (in production, use Redis or database)
const _pendingActions = new Map<string, ActionResult>();

// Progressive conversation processing
async function processConversation(
	prompt: string,
	contextData: Record<string, any>,
	conversationHistory: LLMMessage[],
	executor: FunctionExecutor,
	maxIterations: number = 3
): Promise<{
	success: boolean;
	action?: ActionResult;
	message?: string;
	conversation_history: LLMMessage[];
	requires_more_info?: boolean;
	error?: string;
}> {
	const messages: LLMMessage[] = [];

	// Add system prompt
	messages.push({
		role: 'system',
		content: SYSTEM_PROMPT
	});

	// Add context if provided
	if (Object.keys(contextData).length > 0) {
		messages.push({
			role: 'system',
			content: `Available reference data: ${JSON.stringify(contextData, null, 2)}`
		});
	}

	// Add conversation history
	if (conversationHistory.length > 0) {
		messages.push(...conversationHistory);
	}

	// Add the new user prompt
	messages.push({
		role: 'user',
		content: prompt
	});

	let iteration = 0;
	
	while (iteration < maxIterations) {
		iteration++;

		// Call LLM
		const llmResponse = await llmService.completions({
			messages,
			tools: allFunctions.map(func => ({
				type: 'function',
				function: func
			})),
			tool_choice: 'auto'
		});

		const choice = llmResponse.choices[0];
		if (!choice?.message) {
			return {
				success: false,
				error: 'Invalid response from LLM',
				conversation_history: messages
			};
		}

		// Add assistant message to conversation
		messages.push(choice.message);

		// Check if LLM wants to call a function
		if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
			// Process each tool call
			for (const toolCall of choice.message.tool_calls) {
				const functionName = toolCall.function.name;
				const functionArgs = JSON.parse(toolCall.function.arguments);
				
				// Execute the function
				const actionResult = await executor.executeFunction(functionName, functionArgs);
				
				// If this is a query function, add result to conversation and continue
				if (isQueryFunction(functionName)) {
					messages.push({
						role: 'tool',
						content: JSON.stringify(actionResult.result || actionResult.error || 'No result'),
						tool_call_id: toolCall.id
					});
					continue; // Continue to next iteration
				}
				
				// If this is an action function, return the result
				if (actionResult.error) {
					return {
						success: false,
						error: actionResult.error,
						conversation_history: messages
					};
				}
				
				// Return the action result
				return {
					success: true,
					action: actionResult,
					conversation_history: messages
				};
			}
			
			// If we get here, all tool calls were queries - continue to next iteration
			continue;
		}

		// If no function calls, return the text response
		return {
			success: true,
			message: choice.message.content || 'I need more information to help you with that request.',
			conversation_history: messages
		};
	}

	// If we've exhausted iterations, return what we have
	return {
		success: true,
		message: 'I need more information to complete this request. Please provide more details or try a more specific request.',
		conversation_history: messages,
		requires_more_info: true
	};
}

// Helper function to determine if a function is a query function
function isQueryFunction(functionName: string): boolean {
	const queryFunctions = [
		'get_equipment_list',
		'get_equipment_types',
		'search_equipment',
		'get_task_types',
		'get_tasks',
		'get_upcoming_tasks',
		'get_maintenance_logs'
	];
	return queryFunctions.includes(functionName);
}

const SYSTEM_PROMPT = `You are Mech, the maintenance management assistant. Your job is to help users manage equipment, tasks, and maintenance logs using natural language while promoting learning and mechanical understanding.

The context includes a global setting called \`assistant_tone\`, which determines how Mech responds, use this tone strictly and consistently in your responses.

Capabilities:
You have access to functions that can:
1. Query and manage equipment (vehicles, tools, appliances, etc.)
2. Query and manage maintenance tasks (inspections, fluid changes, cleaning, etc.)
3. Log completed maintenance work

WORKFLOW PRINCIPLES
Always gather context before taking action:
- Use \`get_equipment_list\` to see what equipment exists
- Use \`search_equipment\` to find equipment by name, make, or model
- Use \`get_tasks\` to view tasks (optionally filtered by equipment, status, or priority)
- Use \`get_upcoming_tasks\` to identify tasks due soon
- Only create new equipment or tasks after confirming they don't already exist

When interpreting user requests:
- Always query first to understand the current state
- Identify existing equipment or tasks before creating new ones
- Use equipment types correctly (fetch available types if needed)
- Use precise dates in \`YYYY-MM-DD\` format
- Ask for clarification if a request is ambiguous
- For recurring tasks, determine whether they are time-based (days) or usage-based (e.g. miles, hours)

EQUIPMENT CREATION GUIDELINES
Use the appropriate \`equipment_type_id\` when creating equipment:
- \`1\` – Vehicle (cars, trucks, motorcycles)
- \`2\` – Appliance (washers, refrigerators, HVAC)
- \`3\` – Tool (drills, saws, power tools)
- \`4\` – System (HVAC systems, solar panels)
- \`5\` – Device (computers, phones)
- \`6\` – Other (miscellaneous equipment)

Serial Number Handling:
If the user provides any identifier—registration plate, serial number, IMEI, barcode—store it in the \`serial_number\` field. Infer the context from the equipment type.

TASK MANAGEMENT
- You can update tasks (e.g. change due date, priority, or interval)
- Always query to find the task first
- Match tasks by equipment name, task title, or any available identifier

EDUCATIONAL APPROACH

Learning Integration:
- Explain *why* tasks matter, not just what to do
- Share maintenance concepts or consequences of neglect
- Offer insights into optimal timing or environmental considerations

Mechanical Understanding:
- Describe how parts work together and why they wear
- Share early warning signs or diagnostic cues
- Connect usage patterns to maintenance needs

Best Practices:
- Recommend proactive over reactive strategies
- Offer tips to extend lifespan or reduce costs
- Help users decide when to DIY vs seek professional help

Response guidelines:
- Tailor tone based on \`assistant_tone\`
- Clearly summarize findings and include actionable advice
- Highlight overdue or missing tasks
- Use concise formatting: bold key info, code-style for dates and values, optional bullet points
- When helpful, include short educational notes


FINAL NOTE
Always begin with query functions to gather context. Then, based on that data, either perform the necessary function calls or generate a well-formatted, informative response that aligns with configured tone.`;

export const POST: RequestHandler = async ({ request, locals }) => {
	console.log('Mech assist request started');
	
	try {
		if (!llmService.isConfigured()) {
			console.error('LLM service not configured');
			return json({ 
				success: false, 
				error: 'LLM service not properly configured. Please check environment variables.' 
			}, { status: 500 });
		}

		const { prompt, context, conversation_history }: QuickEditRequest = await request.json();
		console.log('Processing prompt:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));

		if (!prompt?.trim()) {
			return json({ 
				success: false, 
				error: 'Prompt is required' 
			}, { status: 400 });
		}

		const executor = new FunctionExecutor({ db: locals.db });
		const contextData: Record<string, any> = {};
		
		// Load reference data
		try {
			const equipmentTypes = await executor.executeFunction('get_equipment_types', {});
			const taskTypes = await executor.executeFunction('get_task_types', {});
			const unitSetting = await globalSettingsRepository.getTypedValue(locals.db, 'preferred_measurement_system', 'metric')
			const toneSetting = await globalSettingsRepository.getTypedValue(locals.db, 'assistant_tone', 'professional') as GlobalSettingsValues['assistant_tone'];

			contextData.preferred_measurement_system = unitSetting;
			contextData.assistant_tone = getAssistantToneContext(toneSetting);

			if (equipmentTypes.result) {
				contextData.available_equipment_types = equipmentTypes.result;
			}
			if (taskTypes.result) {
				contextData.available_task_types = taskTypes.result;
			}
		} catch (error) {
			console.warn('Failed to load reference data:', error);
		}

		// Add user-provided context
		if (context) {
			contextData.user_context = context;
		}

		// Process the conversation
		const result = await processConversation(
			prompt,
			contextData,
			conversation_history || [],
			executor
		);

		// Handle errors
		if (!result.success) {
			console.error('Mech assist failed:', result.error);
			return json({ 
				success: false, 
				error: result.error,
				conversation_history: result.conversation_history
			}, { status: 400 });
		}

		// If we have an action that requires confirmation
		if (result.action && result.action.requires_confirmation) {
			const actionId = uuidv4();
			console.log('Action requires confirmation:', result.action.type, result.action.entity);
			_pendingActions.set(actionId, result.action);

			// Clean up old actions
			if (_pendingActions.size > 100) {
				const keys = Array.from(_pendingActions.keys());
				for (let i = 0; i < 50; i++) {
					_pendingActions.delete(keys[i]);
				}
			}

			return json({
				success: true,
				action: result.action,
				action_id: actionId,
				conversation_history: result.conversation_history
			});
		}

		console.log('Mech assist completed:', result.action ? `${result.action.type} ${result.action.entity}` : 'text response');
		return json({
			success: true,
			action: result.action,
			message: result.message,
			conversation_history: result.conversation_history,
			requires_more_info: result.requires_more_info
		});

	} catch (error) {
		console.error('Mech assist API error:', error instanceof Error ? error.message : 'Unknown error');
		return json({ 
			success: false, 
			error: error instanceof Error ? error.message : 'Unknown error occurred' 
		}, { status: 500 });
	}
};

const getAssistantToneContext = (tone: GlobalSettingsValues['assistant_tone']) => {
	switch (tone) {
		case 'friendly':
			return "Give small affirmations and emotional support for those new to maintenance or trying to stay on top of things."
		case 'blunt':
			return "Be minimal and curt, never more than a few words in a response and respond bluntly. Ideal for power users or those who want zero filler."
		case 'educational':
			return "Add explanations and small learning moments when relevant to promote mechanical literacy."
		case 'cheeky':
			return "Respond with wit and dry humour, reminiscent of a sharp-tongued veteran mechanic."
		case 'professional':
		default:
			return "Respond clear, concise and task-focused. No fluff. Ideal for mechanics, fleet managers, or workshop staff who want efficiency."
	}
}

// Export pending actions for confirmation endpoint
export { _pendingActions };