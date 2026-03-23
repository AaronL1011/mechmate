// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Kysely } from 'kysely';
import type { Database } from './lib/types/db.js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			db: Kysely<Database>;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

declare module '$env/static/private' {
	export const OPENAI_API_KEY: string;
	export const OPENAI_BASE_URL: string;
	export const OPENAI_MODEL: string;
	export const OPENAI_TEMPERATURE: string;
	export const OPENAI_MAX_TOKENS: string;
	export const VAPID_PUBLIC_KEY: string;
	export const VAPID_PRIVATE_KEY: string;
	export const VAPID_SUBJECT: string;
}

export {};
