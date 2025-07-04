import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/utils/db.js';
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
const pendingActions = new Map<string, ActionResult>();

const SYSTEM_PROMPT = `You are a maintenance management assistant. Your job is to help users manage equipment, tasks, and maintenance logs using natural language.

You have access to functions that can:
1. Query and manage equipment (vehicles, tools, appliances, etc.)
2. Create, update, and delete maintenance tasks
3. Log completed maintenance work

When interpreting user requests:
- Always search for existing equipment first before creating new ones
- Use equipment types appropriately (get available types first)
- Be precise with dates (use YYYY-MM-DD format)
- Ask for clarification if the request is ambiguous
- For recurring tasks, determine if they should be time-based (days) or usage-based (miles/hours)

For equipment creation, common equipment types include:
- vehicle (cars, trucks, motorcycles)
- tool (drills, saws, power tools)
- appliance (washers, refrigerators, HVAC)
- system (HVAC systems, solar panels)
- device (computers, phones)
- other (miscellaneous equipment)

Always try to gather enough context to provide specific, actionable function calls.`;

export const POST: RequestHandler = async ({ request }) => {
	try {
		if (!llmService.isConfigured()) {
			return json({ 
				success: false, 
				error: 'LLM service not properly configured. Please check environment variables.' 
			}, { status: 500 });
		}

		const { prompt, context }: QuickEditRequest = await request.json();

		if (!prompt?.trim()) {
			return json({ 
				success: false, 
				error: 'Prompt is required' 
			}, { status: 400 });
		}

		// Create function executor
		const executor = new FunctionExecutor({ db });

		// Build context for LLM
		const contextData: Record<string, any> = {};
		
		// Always include available equipment types and task types for context
		try {
			const equipmentTypes = await executor.executeFunction('get_equipment_types', {});
			const taskTypes = await executor.executeFunction('get_task_types', {});
			
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
			const equipmentList = await executor.executeFunction('get_equipment_list', {});
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
			}
		} catch (error) {
			console.warn('Failed to load equipment list:', error);
		}

		// Add user-provided context
		if (context) {
			contextData.user_context = context;
		}

		// Call LLM with functions
		const llmResponse = await llmService.processPrompt(
			prompt,
			allFunctions,
			SYSTEM_PROMPT,
			contextData
		);

		// Check if LLM wants to call a function
		const choice = llmResponse.choices[0];
		if (!choice?.message) {
			return json({ 
				success: false, 
				error: 'Invalid response from LLM' 
			}, { status: 500 });
		}

		// Handle function calls (tool_calls format)
		if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
			const toolCall = choice.message.tool_calls[0];
			const functionName = toolCall.function.name;
			const functionArgs = JSON.parse(toolCall.function.arguments);

			// Execute the function
			const actionResult = await executor.executeFunction(functionName, functionArgs);

			if (actionResult.error) {
				return json({ 
					success: false, 
					error: actionResult.error 
				}, { status: 400 });
			}

			// If action requires confirmation, store it and return confirmation request
			if (actionResult.requires_confirmation) {
				const actionId = uuidv4();
				pendingActions.set(actionId, actionResult);

				// Clean up old actions (simple cleanup)
				if (pendingActions.size > 100) {
					const keys = Array.from(pendingActions.keys());
					for (let i = 0; i < 50; i++) {
						pendingActions.delete(keys[i]);
					}
				}

				return json({
					success: true,
					action: actionResult,
					action_id: actionId
				});
			}

			// If no confirmation needed, return the result directly
			return json({
				success: true,
				action: actionResult,
				message: 'Action completed successfully'
			});
		}

		// If no function was called, return the LLM's text response
		return json({
			success: true,
			message: choice.message.content || 'I need more information to help you with that request.'
		});

	} catch (error) {
		console.error('Quick Edit API error:', error);
		return json({ 
			success: false, 
			error: error instanceof Error ? error.message : 'Unknown error occurred' 
		}, { status: 500 });
	}
};

// Export pending actions for confirmation endpoint
export { pendingActions };