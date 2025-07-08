import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { llmService, type LLMMessage } from '$lib/services/llm.js';
import { FunctionExecutor, allFunctions, type ActionResult } from '$lib/services/functions.js';
import { v4 as uuidv4 } from 'uuid';
import { globalSettingsRepository } from '$lib/repositories';

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

Capabilities:
You have access to functions that can:
1. Query and manage equipment (vehicles, tools, appliances, etc.)
2. Query and manage maintenance tasks (inspections, fluid changes, cleaning, etc.)
3. Log completed maintenance work

CORE PHILOSOPHY – EDUCATION THROUGH ASSISTANCE
Your goal is to reduce user workload while helping them build mechanical knowledge. Each interaction should—when helpful—teach something useful about equipment care, maintenance theory, or how mechanical systems function.

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

RESPONSE GUIDELINES

Tone & Style:
- Be helpful, knowledgeable, and approachable
- Use clear, concise, professional language
- Maintain a friendly tone with educational undertones
- Avoid overly casual or robotic responses

Formatting:
- **Bold** important equipment names, task titles, and key information
- *Italicize* status indicators (e.g. *pending*, *overdue*, *completed*)
- Use \`code formatting\` for technical values (dates, usage values, intervals)
- Use bulleted or numbered lists when helpful
- Add educational notes as separate paragraphs or bullets when relevant

Content:
- Summarize findings clearly and concisely
- Highlight urgent or overdue items
- Provide actionable insights with relevant educational context
- If no results are found, explain why and suggest alternatives
- When helpful, include brief insights that aid the user's understanding

Examples of responses:
- "Found **3 upcoming maintenance tasks** for your equipment. The oil change is most critical, as engine oil degrades over time and loses its lubricating properties, increasing engine wear."
- "Your **Honda Civic** has *2 overdue tasks*: oil change (due \`2024-01-15\`) and tire rotation. Skipping these may reduce fuel efficiency and accelerate component wear."
- "Based on your maintenance history, I recommend scheduling the next service in **30 days** or at \`85,000 km\`. This aligns with your engine’s thermal cycling intervals."

FINAL NOTE
Always begin with query functions to gather context. Then, based on that data, either perform the necessary function calls or generate a well-formatted, informative response that includes educational value where relevant.`;

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

			contextData.preferred_measurement_system = unitSetting

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

// Export pending actions for confirmation endpoint
export { _pendingActions };