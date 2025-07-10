import type { Handle } from '@sveltejs/kit';
import SQLite from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import type { Database } from './lib/types/db.js';
import { initializeTables, seedData } from './lib/utils/db.js';
import { startScheduler } from './lib/utils/scheduler.js';
import { getDatabasePath, getConfig } from './lib/config.js';
import { applyRateLimit, addSecurityHeaders, applyCORS } from './lib/middleware/security.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

// Load configuration
const config = getConfig();
const databasePath = getDatabasePath(config);

// Ensure database directory exists
mkdirSync(dirname(databasePath), { recursive: true });

console.log(`🔧 Mechmate ${config.MECHMATE_VERSION} starting...`);
console.log(`📁 Database: ${databasePath}`);
console.log(`🌐 Server: http://${config.HOST}:${config.PORT}`);

const dialect = new SqliteDialect({
	database: new SQLite(databasePath)
});

const db = new Kysely<Database>({
	dialect
});

await initializeTables(db).catch((err) => {
	console.error('🚨 Failed to initialize tables:', err);
});

await seedData(db).catch((err) => {
	console.error('🚨 Failed to seed data:', err);
});

// Start notification scheduler
startScheduler(db);

export const handle: Handle = async ({ event, resolve }) => {
	// Apply security middleware
	try {
		// Rate limiting for API routes
		if (event.url.pathname.startsWith('/api/')) {
			await applyRateLimit(event);
		}
	} catch (err) {
		// Rate limit error - return early with proper headers
		const response = new Response(err instanceof Error ? err.message : 'Rate limit exceeded', {
			status: 429,
			headers: {
				'Content-Type': 'text/plain',
				'Retry-After': '900' // 15 minutes
			}
		});
		return addSecurityHeaders(applyCORS(event, response));
	}

	// Set database instance
	if (!event.locals.db) {
		event.locals.db = db;
	}

	// Handle CORS preflight
	if (event.request.method === 'OPTIONS') {
		const response = new Response(null, { status: 200 });
		return addSecurityHeaders(applyCORS(event, response));
	}

	// Process request
	const response = await resolve(event);

	// Apply security headers and CORS
	return addSecurityHeaders(applyCORS(event, response));
};
