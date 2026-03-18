import type { LLMFunction } from '$lib/services/llm.js';
import { allFunctions } from '$lib/services/functions.js';

export const QUERY_TOOL_NAMES = [
	'get_equipment_list',
	'get_equipment_types',
	'search_equipment',
	'get_task_types',
	'get_tasks',
	'get_upcoming_tasks',
	'get_maintenance_logs',
	'generate_suggestions'
] as const;

export function isQueryTool(name: string): boolean {
	return QUERY_TOOL_NAMES.includes(name as (typeof QUERY_TOOL_NAMES)[number]);
}

export function getToolDefinitionsForLLM(queryOnly: boolean): LLMFunction[] {
	if (queryOnly) {
		return allFunctions.filter((f) => isQueryTool(f.name));
	}
	return [...allFunctions];
}

export { allFunctions };
export type { LLMFunction };
