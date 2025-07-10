// Environment configuration management for Mechmate
import { z } from 'zod';
import { join } from 'path';

// Configuration schema with validation
const ConfigSchema = z.object({
	// Application settings
	NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
	PORT: z.coerce.number().min(1).max(65535).default(3000),
	HOST: z.string().default('0.0.0.0'),

	// Database settings
	DATABASE_DIR: z.string().default('data'),
	DATABASE_BACKUP_DIR: z.string().default('data/backups'),
	DATABASE_BACKUP_RETENTION_DAYS: z.coerce.number().min(1).default(30),

	// Application metadata
	MECHMATE_VERSION: z.string().default('0.0.1'),
	INSTANCE_NAME: z.string().default('Mechmate Self-Hosted'),

	// Security settings
	RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
	RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
	RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

	// LLM/AI settings (optional)
	OPENAI_API_KEY: z.string().optional(),
	OPENAI_BASE_URL: z.string().url().optional(),
	OPENAI_MODEL: z.string().default('gpt-4'),
	LLM_TIMEOUT_MS: z.coerce.number().default(30000),

	// Push notification settings (optional)
	VAPID_PRIVATE_KEY: z.string().optional(),
	VAPID_PUBLIC_KEY: z.string().optional(),
	VAPID_SUBJECT: z.string().optional(),

	// Storage settings
	UPLOAD_MAX_SIZE_MB: z.coerce.number().min(1).max(100).default(10),
	UPLOAD_DIR: z.string().default('data/uploads'),

	// Monitoring and logging
	LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
	HEALTH_CHECK_ENABLED: z.coerce.boolean().default(true),
	METRICS_ENABLED: z.coerce.boolean().default(false),

	// Backup settings
	AUTO_BACKUP_ENABLED: z.coerce.boolean().default(true),
	AUTO_BACKUP_INTERVAL_HOURS: z.coerce.number().min(1).default(24),
	AUTO_BACKUP_MAX_FILES: z.coerce.number().min(1).default(7),

	// Development settings
	ENABLE_DEBUG_LOGS: z.coerce.boolean().default(false),
	CORS_ENABLED: z.coerce.boolean().default(false),
	CORS_ORIGIN: z.string().optional()
});

export type Config = z.infer<typeof ConfigSchema>;

// Load and validate configuration
function loadConfig(): Config {
	try {
		const config = ConfigSchema.parse(process.env);

		// Additional validation
		if (config.NODE_ENV === 'production') {
			// Warn about missing optional production settings
			if (!config.OPENAI_API_KEY) {
				console.warn('⚠️  OPENAI_API_KEY not set - AI assistant will be disabled');
			}

			if (!config.VAPID_PRIVATE_KEY || !config.VAPID_PUBLIC_KEY) {
				console.warn('⚠️  VAPID keys not set - push notifications will be disabled');
			}
		}

		return config;
	} catch (error: unknown) {
		if (error instanceof z.ZodError) {
			console.error('❌ Configuration validation failed:');
			error.errors.forEach((err: z.ZodIssue) => {
				console.error(`  - ${err.path.join('.')}: ${err.message}`);
			});
			process.exit(1);
		}
		throw error;
	}
}

// Singleton configuration instance
let configInstance: Config | null = null;

export function getConfig(): Config {
	if (!configInstance) {
		configInstance = loadConfig();
	}
	return configInstance;
}

// Helper functions for common configuration checks
export function isDevelopment(): boolean {
	return getConfig().NODE_ENV === 'development';
}

export function isProduction(): boolean {
	return getConfig().NODE_ENV === 'production';
}

export function isLLMEnabled(): boolean {
	return !!getConfig().OPENAI_API_KEY;
}

export function areNotificationsEnabled(): boolean {
	const config = getConfig();
	return !!(config.VAPID_PRIVATE_KEY && config.VAPID_PUBLIC_KEY && config.VAPID_SUBJECT);
}

// Configuration validation for specific features
export function validateLLMConfig(): { enabled: boolean; error?: string } {
	const config = getConfig();

	if (!config.OPENAI_API_KEY) {
		return { enabled: false, error: 'OPENAI_API_KEY not configured' };
	}

	if (config.OPENAI_BASE_URL) {
		try {
			new URL(config.OPENAI_BASE_URL);
		} catch {
			return { enabled: false, error: 'OPENAI_BASE_URL is not a valid URL' };
		}
	}

	return { enabled: true };
}

export function validateNotificationConfig(): { enabled: boolean; error?: string } {
	const config = getConfig();

	if (!config.VAPID_PRIVATE_KEY) {
		return { enabled: false, error: 'VAPID_PRIVATE_KEY not configured' };
	}

	if (!config.VAPID_PUBLIC_KEY) {
		return { enabled: false, error: 'VAPID_PUBLIC_KEY not configured' };
	}

	if (!config.VAPID_SUBJECT) {
		return { enabled: false, error: 'VAPID_SUBJECT not configured' };
	}

	return { enabled: true };
}

// Helper functions for constructing full paths
export function getDatabasePath(config?: Config): string {
	const cfg = config || getConfig();
	return join(cfg.DATABASE_DIR, 'mechmate.db');
}

export function getBackupDir(config?: Config): string {
	const cfg = config || getConfig();
	return cfg.DATABASE_BACKUP_DIR;
}

export function getUploadDir(config?: Config): string {
	const cfg = config || getConfig();
	return cfg.UPLOAD_DIR;
}

// Export schema for documentation generation
export { ConfigSchema };
