// Backup and restore utilities for Mechmate
import { getConfig, getDatabasePath, getBackupDir } from '../config.js';
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

export interface BackupInfo {
	filename: string;
	path: string;
	size: number;
	created_at: string;
	type: 'manual' | 'automatic';
}

export interface BackupResult {
	success: boolean;
	filename?: string;
	path?: string;
	size?: number;
	error?: string;
	duration_ms?: number;
}

export interface RestoreResult {
	success: boolean;
	backup_filename?: string;
	error?: string;
	duration_ms?: number;
}

export class BackupManager {
	private config = getConfig();
	private dbPath = getDatabasePath();
	private backupDir = getBackupDir();

	constructor() {
		// Ensure backup directory exists
		if (!existsSync(this.backupDir)) {
			mkdirSync(this.backupDir, { recursive: true });
		}
	}

	/**
	 * Create a backup of the database
	 */
	async createBackup(type: 'manual' | 'automatic' = 'manual'): Promise<BackupResult> {
		const startTime = Date.now();

		try {
			// Check if database exists
			if (!existsSync(this.dbPath)) {
				return {
					success: false,
					error: 'Database file not found'
				};
			}

			// Generate backup filename
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const filename = `mechmate-backup-${timestamp}-${type}.db`;
			const backupPath = join(this.backupDir, filename);

			// Create backup using SQLite backup command for consistency
			try {
				// Use SQLite .backup command for a consistent backup
				const command = `sqlite3 "${this.dbPath}" ".backup '${backupPath}'"`;
				execSync(command, { stdio: 'pipe' });
			} catch (_) {
				// Fallback to file copy if SQLite command fails
				console.warn('SQLite backup command failed, falling back to file copy');
				copyFileSync(this.dbPath, backupPath);
			}

			// Get backup file size
			const stats = statSync(backupPath);
			const size = stats.size;

			// Clean up old backups if this is automatic
			if (type === 'automatic') {
				await this.cleanupOldBackups();
			}

			return {
				success: true,
				filename,
				path: backupPath,
				size,
				duration_ms: Date.now() - startTime
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown backup error',
				duration_ms: Date.now() - startTime
			};
		}
	}

	/**
	 * List all available backups
	 */
	listBackups(): BackupInfo[] {
		try {
			if (!existsSync(this.backupDir)) {
				return [];
			}

			const files = readdirSync(this.backupDir);
			const backups: BackupInfo[] = [];

			for (const file of files) {
				if (file.endsWith('.db') && file.startsWith('mechmate-backup-')) {
					const filePath = join(this.backupDir, file);
					const stats = statSync(filePath);

					// Determine backup type from filename
					const type = file.includes('-automatic.db') ? 'automatic' : 'manual';

					backups.push({
						filename: file,
						path: filePath,
						size: stats.size,
						created_at: stats.birthtime.toISOString(),
						type
					});
				}
			}

			// Sort by creation date (newest first)
			return backups.sort(
				(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
			);
		} catch (error) {
			console.error('Failed to list backups:', error);
			return [];
		}
	}

	/**
	 * Restore database from backup
	 */
	async restoreFromBackup(backupFilename: string): Promise<RestoreResult> {
		const startTime = Date.now();

		try {
			const backupPath = join(this.backupDir, backupFilename);

			// Check if backup file exists
			if (!existsSync(backupPath)) {
				return {
					success: false,
					error: 'Backup file not found'
				};
			}

			// Create a backup of current database before restore
			const currentBackupResult = await this.createBackup('manual');
			if (!currentBackupResult.success) {
				console.warn('Failed to backup current database before restore');
			}

			// Restore the database
			copyFileSync(backupPath, this.dbPath);

			return {
				success: true,
				backup_filename: backupFilename,
				duration_ms: Date.now() - startTime
			};
		} catch (error) {
			return {
				success: false,
				backup_filename: backupFilename,
				error: error instanceof Error ? error.message : 'Unknown restore error',
				duration_ms: Date.now() - startTime
			};
		}
	}

	/**
	 * Delete a backup file
	 */
	deleteBackup(backupFilename: string): { success: boolean; error?: string } {
		try {
			const backupPath = join(this.backupDir, backupFilename);

			if (!existsSync(backupPath)) {
				return {
					success: false,
					error: 'Backup file not found'
				};
			}

			unlinkSync(backupPath);
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown delete error'
			};
		}
	}

	/**
	 * Clean up old automatic backups based on retention policy
	 */
	private async cleanupOldBackups(): Promise<void> {
		try {
			const backups = this.listBackups();
			const automaticBackups = backups.filter((b) => b.type === 'automatic');

			// Keep only the configured number of automatic backups
			const maxBackups = this.config.AUTO_BACKUP_MAX_FILES;
			if (automaticBackups.length > maxBackups) {
				const backupsToDelete = automaticBackups.slice(maxBackups);

				for (const backup of backupsToDelete) {
					this.deleteBackup(backup.filename);
				}
			}

			// Also clean up backups older than retention period
			const retentionMs = this.config.DATABASE_BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
			const cutoffTime = Date.now() - retentionMs;

			for (const backup of automaticBackups) {
				const backupAge = new Date(backup.created_at).getTime();
				if (backupAge < cutoffTime) {
					this.deleteBackup(backup.filename);
				}
			}
		} catch (error) {
			console.error('Failed to clean up old backups:', error);
		}
	}

	/**
	 * Get backup statistics
	 */
	getBackupStats(): {
		total_backups: number;
		automatic_backups: number;
		manual_backups: number;
		total_size_bytes: number;
		oldest_backup?: string;
		newest_backup?: string;
	} {
		const backups = this.listBackups();

		return {
			total_backups: backups.length,
			automatic_backups: backups.filter((b) => b.type === 'automatic').length,
			manual_backups: backups.filter((b) => b.type === 'manual').length,
			total_size_bytes: backups.reduce((sum, b) => sum + b.size, 0),
			oldest_backup: backups.length > 0 ? backups[backups.length - 1].created_at : undefined,
			newest_backup: backups.length > 0 ? backups[0].created_at : undefined
		};
	}
}

// Export singleton instance
export const backupManager = new BackupManager();
