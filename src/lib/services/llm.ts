import {
	OPENAI_API_KEY,
	OPENAI_BASE_URL,
	OPENAI_MODEL,
	OPENAI_TEMPERATURE,
	OPENAI_MAX_TOKENS
} from '$env/static/private';

export interface LLMMessage {
	role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
	content: string;
	name?: string;
	function_call?: {
		name: string;
		arguments: string;
	};
	tool_calls?: {
		id: string;
		type: 'function';
		function: {
			name: string;
			arguments: string;
		};
	}[];
	tool_call_id?: string;
}

export interface LLMFunction {
	name: string;
	description: string;
	parameters: {
		type: 'object';
		properties: Record<string, any>;
		required: string[];
	};
}

export interface LLMResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: {
		index: number;
		message: LLMMessage;
		finish_reason: string;
	}[];
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

export interface LLMRequest {
	model: string;
	messages: LLMMessage[];
	functions?: LLMFunction[];
	function_call?: 'auto' | 'none' | { name: string };
	tools?: {
		type: 'function';
		function: LLMFunction;
	}[];
	tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
	temperature?: number;
	max_tokens?: number;
	stream?: boolean;
}

export class LLMService {
	private apiKey: string;
	private baseUrl: string;
	private model: string;
	private temperature: number;
	private maxTokens: number;

	constructor() {
		this.apiKey = OPENAI_API_KEY || '';
		this.baseUrl = OPENAI_BASE_URL || 'https://api.openai.com/v1';
		this.model = OPENAI_MODEL || 'gpt-4';
		this.temperature = parseFloat(OPENAI_TEMPERATURE || '0.1');
		this.maxTokens = parseInt(OPENAI_MAX_TOKENS || '1000');

		// Ensure baseUrl ends with correct path
		if (!this.baseUrl.endsWith('/v1')) {
			this.baseUrl = this.baseUrl.replace(/\/$/, '') + '/v1';
		}
	}

	async completions(request: Omit<LLMRequest, 'model'>): Promise<LLMResponse> {
		const url = `${this.baseUrl}/chat/completions`;

		const body: LLMRequest = {
			model: this.model,
			temperature: this.temperature,
			max_tokens: this.maxTokens,
			...request
		};

		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		// Add authorization header if API key is provided
		if (this.apiKey) {
			headers['Authorization'] = `Bearer ${this.apiKey}`;
		}

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(body)
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`LLM API error: ${response.status} - ${errorText}`);
			}

			const data = await response.json();
			return data as LLMResponse;
		} catch (error) {
			console.error('LLM API request failed:', error);
			throw new Error(
				`Failed to call LLM API: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	async processPrompt(
		prompt: string,
		functions: LLMFunction[] = [],
		systemPrompt?: string,
		context?: Record<string, any>
	): Promise<LLMResponse> {
		const messages: LLMMessage[] = [];

		// Add system prompt if provided
		if (systemPrompt) {
			messages.push({
				role: 'system',
				content: systemPrompt
			});
		}

		// Add context if provided
		if (context) {
			messages.push({
				role: 'system',
				content: `Context: ${JSON.stringify(context, null, 2)}`
			});
		}

		// Add user prompt
		messages.push({
			role: 'user',
			content: prompt
		});

		const request: Omit<LLMRequest, 'model'> = {
			messages
		};

		// Add functions/tools if provided
		if (functions.length > 0) {
			// Use tools format for OpenAI API compatibility
			request.tools = functions.map((func) => ({
				type: 'function',
				function: func
			}));
			request.tool_choice = 'auto';
		}

		return this.completions(request);
	}

	isConfigured(): boolean {
		return Boolean(this.baseUrl && (this.apiKey || this.baseUrl.includes('ollama')));
	}

	getConfig() {
		return {
			baseUrl: this.baseUrl,
			model: this.model,
			temperature: this.temperature,
			maxTokens: this.maxTokens,
			hasApiKey: Boolean(this.apiKey),
			isConfigured: this.isConfigured()
		};
	}
}

export const llmService = new LLMService();
