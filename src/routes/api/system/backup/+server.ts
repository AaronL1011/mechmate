// Backup management API endpoints
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { backupManager } from '$lib/utils/backup.js';

// GET /api/system/backup - List all backups
export const GET: RequestHandler = async () => {
	try {
		const backups = backupManager.listBackups();
		const stats = backupManager.getBackupStats();

		return json({
			backups,
			stats
		});
	} catch (err) {
		console.error('Failed to list backups:', err);
		throw error(500, 'Failed to list backups');
	}
};

// POST /api/system/backup - Create a new backup
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const type = body.type === 'automatic' ? 'automatic' : 'manual';

		const result = await backupManager.createBackup(type);

		if (result.success) {
			return json({
				success: true,
				message: 'Backup created successfully',
				backup: {
					filename: result.filename,
					size: result.size,
					duration_ms: result.duration_ms
				}
			});
		} else {
			throw error(500, result.error || 'Backup creation failed');
		}
	} catch (err) {
		console.error('Failed to create backup:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to create backup');
	}
};

// DELETE /api/system/backup - Delete a backup
export const DELETE: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { filename } = body;

		if (!filename) {
			throw error(400, 'Backup filename is required');
		}

		const result = backupManager.deleteBackup(filename);

		if (result.success) {
			return json({
				success: true,
				message: 'Backup deleted successfully'
			});
		} else {
			throw error(500, result.error || 'Backup deletion failed');
		}
	} catch (err) {
		console.error('Failed to delete backup:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to delete backup');
	}
};
