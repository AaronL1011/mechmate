import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { llmService } from '$lib/services/llm.js';
import { FunctionExecutor, allFunctions, type ActionResult } from '$lib/services/functions.js';
import { v4 as uuidv4 } from 'uuid';

interface QuickEditRequest {
	prompt: string;
	context?: string;
}

interface QuickEditResponse {
	success: boolean;
	action?: ActionResult;
	action_id?: string;
	message?: string;
	error?: string;
}

// Store pending actions in memory (in production, use Redis or database)
const _pendingActions = new Map<string, ActionResult>();

const SYSTEM_PROMPT = `You are a maintenance management assistant. Your job is to help users manage equipment, tasks, and maintenance logs using natural language.

You have access to functions that can:
1. Query and manage equipment (vehicles, tools, appliances, etc.)
2. Create, update, and delete maintenance tasks
3. Log completed maintenance work

The context includes existing equipment and tasks, allowing you to reference them by name or other attributes.

When interpreting user requests:
- Always search for existing equipment and tasks first before creating new ones
- Use equipment types appropriately (get available types first)
- For task updates, find the task by name, equipment, or due date
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
- Look at existing_tasks and upcoming_tasks in context to find the right task
- Match tasks by equipment name, task title, or other identifiable attributes

IMPORTANT: Always use the available functions by calling them properly. If you need to create equipment, call the create_equipment function with the required parameters. Do not just describe what should be done - actually call the functions.

Always try to gather enough context to provide specific, actionable function calls.`;

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

		const { prompt, context }: QuickEditRequest = await request.json();
		console.log('Request payload:', { prompt, context });

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

		// Build context for LLM
		console.log('Building context data for LLM...');
		const contextData: Record<string, any> = {};
		
		// Always include available equipment types and task types for context
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

		// Get a list of equipment for reference
		try {
			console.log('Fetching existing equipment list...');
			const equipmentList = await executor.executeFunction('get_equipment_list', {});
			console.log('Equipment list result:', equipmentList);
			
			if (equipmentList.result) {
				contextData.existing_equipment = equipmentList.result.map((eq: any) => ({
					id: eq.id,
					name: eq.name,
					make: eq.make,
					model: eq.model,
					equipment_type_id: eq.equipment_type_id,
					current_usage_value: eq.current_usage_value,
					usage_unit: eq.usage_unit
				}));
				console.log('Mapped equipment for context:', contextData.existing_equipment);
			}
		} catch (error) {
			console.warn('Failed to load equipment list:', error);
		}

		// Get all current tasks for reference and context
		try {
			console.log('Fetching all current tasks...');
			const allTasks = await executor.executeFunction('get_tasks', {});
			console.log('All tasks result:', allTasks);
			
			if (allTasks.result) {
				contextData.existing_tasks = allTasks.result.map((task: any) => ({
					id: task.id,
					equipment_id: task.equipment_id,
					task_type_id: task.task_type_id,
					title: task.title,
					description: task.description,
					priority: task.priority,
					status: task.status,
					next_due_date: task.next_due_date,
					next_due_usage_value: task.next_due_usage_value,
					time_interval_days: task.time_interval_days,
					usage_interval: task.usage_interval
				}));
				console.log('Mapped tasks for context:', contextData.existing_tasks);
			}
		} catch (error) {
			console.warn('Failed to load tasks list:', error);
		}

		// Get upcoming tasks for additional context
		try {
			console.log('Fetching upcoming tasks...');
			const upcomingTasks = await executor.executeFunction('get_upcoming_tasks', { days: 90 });
			console.log('Upcoming tasks result:', upcomingTasks);
			
			if (upcomingTasks.result) {
				contextData.upcoming_tasks = upcomingTasks.result.map((task: any) => ({
					id: task.id,
					equipment_id: task.equipment_id,
					title: task.title,
					priority: task.priority,
					status: task.status,
					next_due_date: task.next_due_date,
					next_due_usage_value: task.next_due_usage_value
				}));
				console.log('Mapped upcoming tasks for context:', contextData.upcoming_tasks);
			}
		} catch (error) {
			console.warn('Failed to load upcoming tasks:', error);
		}

		// Add user-provided context
		if (context) {
			console.log('Adding user context:', context);
			contextData.user_context = context;
		}

		console.log('Final context data for LLM:', contextData);
		console.log('Functions available to LLM:', allFunctions.length, 'functions');

		// Call LLM with functions
		console.log('Calling LLM service...');
		const llmResponse = await llmService.processPrompt(
			prompt,
			allFunctions,
			SYSTEM_PROMPT,
			contextData
		);
		console.log('LLM response received:', JSON.stringify(llmResponse, null, 2));

		// Check if LLM wants to call a function
		console.log('Processing LLM response...');
		const choice = llmResponse.choices[0];
		if (!choice?.message) {
			console.error('Invalid LLM response: no message in choice');
			return json({ 
				success: false, 
				error: 'Invalid response from LLM' 
			}, { status: 500 });
		}

		console.log('LLM message:', choice.message);

		// Handle function calls (tool_calls format)
		if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
			console.log('Found tool_calls in response:', choice.message.tool_calls);
			const toolCall = choice.message.tool_calls[0];
			const functionName = toolCall.function.name;
			const functionArgs = JSON.parse(toolCall.function.arguments);

			console.log('Executing function:', functionName, 'with args:', functionArgs);

			// Execute the function
			const actionResult = await executor.executeFunction(functionName, functionArgs);
			console.log('Function execution result:', actionResult);

			if (actionResult.error) {
				console.error('Function execution error:', actionResult.error);
				return json({ 
					success: false, 
					error: actionResult.error 
				}, { status: 400 });
			}

			// If action requires confirmation, store it and return confirmation request
			if (actionResult.requires_confirmation) {
				const actionId = uuidv4();
				console.log('Action requires confirmation, storing with ID:', actionId);
				_pendingActions.set(actionId, actionResult);

				// Clean up old actions (simple cleanup)
				if (_pendingActions.size > 100) {
					console.log('Cleaning up old pending actions...');
					const keys = Array.from(_pendingActions.keys());
					for (let i = 0; i < 50; i++) {
						_pendingActions.delete(keys[i]);
					}
				}

				console.log('Returning confirmation request');
				return json({
					success: true,
					action: actionResult,
					action_id: actionId
				});
			}

			// If no confirmation needed, return the result directly
			console.log('No confirmation needed, returning result directly');
			return json({
				success: true,
				action: actionResult,
				message: 'Action completed successfully'
			});
		}

		// Fallback: Parse tool calls from text content (for models that don't support proper tool calling)
		const messageContent = choice.message.content || '';
		console.log('Checking for text-based tool calls in message content:', messageContent);
		
		// Check for [TOOL_CALLS] format
		if (messageContent.includes('[TOOL_CALLS]')) {
			console.log('Found [TOOL_CALLS] marker in text content');
			try {
				const toolCallsMatch = messageContent.match(/\[TOOL_CALLS\]\[(.+)\]/);
				console.log('Tool calls regex match:', toolCallsMatch);
				
				if (toolCallsMatch) {
					const toolCallData = JSON.parse(toolCallsMatch[1]);
					const functionName = toolCallData.name;
					const functionArgs = toolCallData.arguments;

					console.log('Parsed tool call from [TOOL_CALLS] format:', { functionName, functionArgs });

					// Execute the function
					console.log('Executing function from [TOOL_CALLS] parsing:', functionName, 'with args:', functionArgs);
					const actionResult = await executor.executeFunction(functionName, functionArgs);
					console.log('[TOOL_CALLS] function execution result:', actionResult);

					if (actionResult.error) {
						console.error('[TOOL_CALLS] function execution error:', actionResult.error);
						return json({ 
							success: false, 
							error: actionResult.error 
						}, { status: 400 });
					}

					// If action requires confirmation, store it and return confirmation request
					if (actionResult.requires_confirmation) {
						const actionId = uuidv4();
						console.log('[TOOL_CALLS] action requires confirmation, storing with ID:', actionId);
						_pendingActions.set(actionId, actionResult);

						// Clean up old actions (simple cleanup)
						if (_pendingActions.size > 100) {
							console.log('Cleaning up old pending actions...');
							const keys = Array.from(_pendingActions.keys());
							for (let i = 0; i < 50; i++) {
								_pendingActions.delete(keys[i]);
							}
						}

						console.log('Returning [TOOL_CALLS] confirmation request');
						return json({
							success: true,
							action: actionResult,
							action_id: actionId
						});
					}

					// If no confirmation needed, return the result directly
					console.log('[TOOL_CALLS] action needs no confirmation, returning result directly');
					return json({
						success: true,
						action: actionResult,
						message: 'Action completed successfully'
					});
				}
			} catch (error) {
				console.error('Failed to parse [TOOL_CALLS] from text:', error);
				// Fall through to next parser
			}
		}

		// Check for JSON code block format (qwen2.5-coder-tools style)
		if (messageContent.includes('```json')) {
			console.log('Found JSON code block in text content');
			try {
				const jsonMatch = messageContent.match(/```json\s*\n([\s\S]*?)\n```/);
				console.log('JSON code block regex match:', jsonMatch);
				
				if (jsonMatch) {
					const toolCallData = JSON.parse(jsonMatch[1]);
					const functionName = toolCallData.name;
					const functionArgs = toolCallData.arguments;

					console.log('Parsed tool call from JSON code block:', { functionName, functionArgs });

					// Execute the function
					console.log('Executing function from JSON parsing:', functionName, 'with args:', functionArgs);
					const actionResult = await executor.executeFunction(functionName, functionArgs);
					console.log('JSON-parsed function execution result:', actionResult);

					if (actionResult.error) {
						console.error('JSON-parsed function execution error:', actionResult.error);
						return json({ 
							success: false, 
							error: actionResult.error 
						}, { status: 400 });
					}

					// If action requires confirmation, store it and return confirmation request
					if (actionResult.requires_confirmation) {
						const actionId = uuidv4();
						console.log('JSON-parsed action requires confirmation, storing with ID:', actionId);
						_pendingActions.set(actionId, actionResult);

						// Clean up old actions (simple cleanup)
						if (_pendingActions.size > 100) {
							console.log('Cleaning up old pending actions...');
							const keys = Array.from(_pendingActions.keys());
							for (let i = 0; i < 50; i++) {
								_pendingActions.delete(keys[i]);
							}
						}

						console.log('Returning JSON-parsed confirmation request');
						return json({
							success: true,
							action: actionResult,
							action_id: actionId
						});
					}

					// If no confirmation needed, return the result directly
					console.log('JSON-parsed action needs no confirmation, returning result directly');
					return json({
						success: true,
						action: actionResult,
						message: 'Action completed successfully'
					});
				}
			} catch (error) {
				console.error('Failed to parse JSON code block from text:', error);
				// Fall through to return the text response
			}
		}

		// If no function was called, return the LLM's text response
		console.log('No function calls found, returning LLM text response');
		return json({
			success: true,
			message: choice.message.content || 'I need more information to help you with that request.'
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