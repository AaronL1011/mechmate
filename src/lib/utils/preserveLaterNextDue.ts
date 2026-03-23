import type { Task } from '$lib/types/db.js';

/** Keeps existing last completed when already more recent than this log (e.g. backdated historical entry). */
export function preserveMoreRecentLastCompleted(
	task: Task,
	completedDate: string,
	completedUsage: number | undefined
): { lastCompletedDate: string; lastCompletedUsage: number | undefined } {
	let lastCompletedDate = completedDate;
	let lastCompletedUsage = completedUsage;

	const existingDate = task.last_completed_date;
	if (existingDate && existingDate > lastCompletedDate) {
		lastCompletedDate = existingDate;
	}

	const existingUsage = task.last_completed_usage_value;
	if (
		completedUsage !== undefined &&
		existingUsage != null &&
		existingUsage > completedUsage
	) {
		lastCompletedUsage = existingUsage;
	}

	return { lastCompletedDate, lastCompletedUsage };
}

/** Keeps existing next due when it is already later than completion + interval (e.g. backdated logs). */
export function preserveLaterNextDueSchedule(
	task: Task,
	calculatedNextDueDate: string | undefined,
	calculatedNextDueUsage: number | undefined
): { nextDueDate: string | undefined; nextDueUsageValue: number | undefined } {
	let nextDueDate = calculatedNextDueDate;
	let nextDueUsageValue = calculatedNextDueUsage;

	const existingDate = task.next_due_date;
	if (existingDate && nextDueDate && existingDate > nextDueDate) {
		nextDueDate = existingDate;
	}

	const existingUsage = task.next_due_usage_value;
	if (
		existingUsage != null &&
		nextDueUsageValue != null &&
		existingUsage > nextDueUsageValue
	) {
		nextDueUsageValue = existingUsage;
	}

	return { nextDueDate, nextDueUsageValue };
}
