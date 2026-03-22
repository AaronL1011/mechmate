/** Safe to import from browser code — no Node or DB dependencies. */
export const PROACTIVE_MAX_ACTIVE_SUGGESTIONS = 3;

export interface ProactiveSection {
	title: string;
	content: string;
	agent_action?: string;
	/** Short button text when `agent_action` is present; LLM-authored for generated sections. */
	agent_action_label?: string;
}
