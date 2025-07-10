// Database restore API endpoint
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { backupManager } from '$lib/utils/backup.js';

// POST /api/system/backup/restore - Restore database from backup
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { filename } = body;

		if (!filename) {
			throw error(400, 'Backup filename is required');
		}

		const result = await backupManager.restoreFromBackup(filename);

		if (result.success) {
			return json({
				success: true,
				message: 'Database restored successfully',
				backup_filename: result.backup_filename,
				duration_ms: result.duration_ms
			});
		} else {
			throw error(500, result.error || 'Database restore failed');
		}
	} catch (err) {
		console.error('Failed to restore database:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to restore database');
	}
};
