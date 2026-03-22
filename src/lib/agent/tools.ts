import type { LLMFunction } from '$lib/services/llm.js';
import { allFunctions } from '$lib/services/functions.js';

export const QUERY_TOOL_NAMES = [
	'get_equipment_list',
	'get_equipment_types',
	'search_equipment',
	'list_equipment_resources',
	'get_equipment_resource_excerpt',
	'get_task_types',
	'get_tasks',
	'get_upcoming_tasks',
	'get_maintenance_logs',
	'generate_suggestions'
] as const;

export function isQueryTool(name: string): boolean {
	return QUERY_TOOL_NAMES.includes(name as (typeof QUERY_TOOL_NAMES)[number]);
}

/** Query tools omitted from proactive runs to avoid scanning every equipment's document list. */
export const TOOLS_EXCLUDED_FROM_PROACTIVE_AGENT: readonly string[] = [
	'list_equipment_resources',
	'get_equipment_resource_excerpt'
];

export function getToolDefinitionsForLLM(
	queryOnly: boolean,
	opts?: { excludeToolNames?: readonly string[] }
): LLMFunction[] {
	let list: LLMFunction[];
	if (queryOnly) {
		list = allFunctions.filter((f) => isQueryTool(f.name));
	} else {
		list = [...allFunctions];
	}
	const ex = opts?.excludeToolNames;
	if (ex?.length) {
		const omit = new Set(ex);
		list = list.filter((f) => !omit.has(f.name));
	}
	return list;
}

export { allFunctions };
export type { LLMFunction };
