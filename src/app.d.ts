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

export {};
