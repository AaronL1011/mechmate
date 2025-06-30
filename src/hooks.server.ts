import type { Handle } from '@sveltejs/kit';
import SQLite from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import type { Database } from './lib/types/db.js';
import { initializeTables, seedData } from './lib/utils/db.js';
import { startScheduler } from './lib/utils/scheduler.js';

const dialect = new SqliteDialect({
	database: new SQLite('data/mechmate.db')
});

const db = new Kysely<Database>({
	dialect
});

await initializeTables(db).catch((err) => {
	console.error('Failed to initialize tables:', err);
});

await seedData(db).catch((err) => {
	console.error('Failed to seed data:', err);
});

// Start notification scheduler
startScheduler(db);

export const handle: Handle = async ({ event, resolve }) => {
	if (!event.locals.db) {
		event.locals.db = db;
	}

	const resp = await resolve(event);
	return resp;
}; 