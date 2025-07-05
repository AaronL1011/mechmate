import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { llmService, type LLMMessage } from '$lib/services/llm.js';
import { FunctionExecutor, allFunctions, type ActionResult } from '$lib/services/functions.js';
import { v4 as uuidv4 } from 'uuid';

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

	console.log('Starting progressive conversation processing...');
	let iteration = 0;
	
	while (iteration < maxIterations) {
		iteration++;
		console.log(`Conversation iteration ${iteration}/${maxIterations}`);

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
			console.log(`Found ${choice.message.tool_calls.length} tool calls`);
			
			// Process each tool call
			for (const toolCall of choice.message.tool_calls) {
				const functionName = toolCall.function.name;
				const functionArgs = JSON.parse(toolCall.function.arguments);
				
				console.log(`Executing function: ${functionName}`, functionArgs);
				
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

const SYSTEM_PROMPT = `You are a maintenance management assistant. Your job is to help users manage equipment, tasks, and maintenance logs using natural language.

You have access to functions that can:
1. Query and manage equipment (vehicles, tools, appliances, etc.)
2. Query and manage maintenance tasks (inspections, fluid changes, cleaning, etc.)
3. Log completed maintenance work

IMPORTANT WORKFLOW:
- ALWAYS start by querying for existing data before creating or updating anything
- Use get_equipment_list to see what equipment exists
- Use search_equipment to find specific equipment by name, make, or model
- Use get_tasks to see existing tasks (optionally filtered by equipment, status, or priority)
- Use get_upcoming_tasks to see what's due soon
- Only create new equipment/tasks after confirming they don't already exist

When interpreting user requests:
- Start with queries to understand the current state
- Search for existing equipment and tasks first before creating new ones
- Use equipment types appropriately (get available types first if needed)
- For task updates, find the task by querying first
- Be precise with dates (use YYYY-MM-DD format)
- Ask for clarification if the request is ambiguous
- For recurring tasks, determine if they should be time-based (days) or usage-based (miles/hours)

For equipment creation, common equipment types include:
- vehicle (cars, trucks, motorcycles) - use equipment_type_id: 1
- appliance (washers, refrigerators, HVAC) - use equipment_type_id: 2
- tool (drills, saws, power tools) - use equipment_type_id: 3
- system (HVAC systems, solar panels) - use equipment_type_id: 4
- device (computers, phones) - use equipment_type_id: 5
- other (miscellaneous equipment) - use equipment_type_id: 6

For task management:
- You can update existing tasks (change due dates, priority, intervals, etc.)
- Query for tasks first to find the right one to update
- Match tasks by equipment name, task title, or other identifiable attributes

IMPORTANT: Always use the available functions by calling them properly. Start with query functions to gather context, then perform the requested actions. Do not just describe what should be done - actually call the functions.

Always try to gather enough context through queries to provide specific, actionable function calls.`;

export const POST: RequestHandler = async ({ request, locals }) => {
	console.log('=== Quick Edit Request Started ===');
	
	try {
		console.log('Checking LLM service configuration...');
		if (!llmService.isConfigured()) {
			console.error('LLM service not configured');
			return json({ 
				success: false, 
				error: 'LLM service not properly configured. Please check environment variables.' 
			}, { status: 500 });
		}
		console.log('LLM service configuration OK');

		const { prompt, context, conversation_history }: QuickEditRequest = await request.json();
		console.log('Request payload:', { prompt, context, conversation_history });

		if (!prompt?.trim()) {
			console.error('Empty prompt provided');
			return json({ 
				success: false, 
				error: 'Prompt is required' 
			}, { status: 400 });
		}

		// Create function executor
		console.log('Creating function executor...');
		const executor = new FunctionExecutor({ db: locals.db });

		// Build minimal context for LLM (only essential reference data)
		console.log('Building minimal context data for LLM...');
		const contextData: Record<string, any> = {};
		
		// Only include equipment types and task types for reference
		try {
			console.log('Fetching equipment types and task types...');
			const equipmentTypes = await executor.executeFunction('get_equipment_types', {});
			const taskTypes = await executor.executeFunction('get_task_types', {});
			
			console.log('Equipment types result:', equipmentTypes);
			console.log('Task types result:', taskTypes);
			
			if (equipmentTypes.result) {
				contextData.available_equipment_types = equipmentTypes.result;
			}
			if (taskTypes.result) {
				contextData.available_task_types = taskTypes.result;
			}
		} catch (error) {
			console.warn('Failed to load context data:', error);
		}

		// Note: Equipment and task lists are NOT loaded upfront
		// The LLM will query for this data as needed using the available functions

		// Add user-provided context
		if (context) {
			console.log('Adding user context:', context);
			contextData.user_context = context;
		}

		console.log('Final minimal context data for LLM:', contextData);
		console.log('Functions available to LLM:', allFunctions.length, 'functions');

		// Process the conversation with progressive context building
		console.log('Processing conversation with progressive context building...');
		const result = await processConversation(
			prompt,
			contextData,
			conversation_history || [],
			executor
		);
		console.log('Conversation processing result:', result);

		// Handle errors
		if (!result.success) {
			return json({ 
				success: false, 
				error: result.error,
				conversation_history: result.conversation_history
			}, { status: 400 });
		}

		// If we have an action that requires confirmation
		if (result.action && result.action.requires_confirmation) {
			const actionId = uuidv4();
			console.log('Action requires confirmation, storing with ID:', actionId);
			_pendingActions.set(actionId, result.action);

			// Clean up old actions (simple cleanup)
			if (_pendingActions.size > 100) {
				console.log('Cleaning up old pending actions...');
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

		// Return the result (either action completed or message)
		return json({
			success: true,
			action: result.action,
			message: result.message,
			conversation_history: result.conversation_history,
			requires_more_info: result.requires_more_info
		});

	} catch (error) {
		console.error('=== Quick Edit API Error ===');
		console.error('Error details:', error);
		console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
		return json({ 
			success: false, 
			error: error instanceof Error ? error.message : 'Unknown error occurred' 
		}, { status: 500 });
	}
};

// Export pending actions for confirmation endpoint
export { _pendingActions };