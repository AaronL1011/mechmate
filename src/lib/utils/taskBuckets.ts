import type { Task } from '$lib/types/db.js';

export type TaskDueBucket =
	| 'completed'
	| 'no_due_date'
	| 'overdue'
	| 'due_today'
	| 'due_this_week'
	| 'later';

export const BUCKET_ORDER: TaskDueBucket[] = [
	'overdue',
	'due_today',
	'due_this_week',
	'later',
	'no_due_date',
	'completed'
];

export const BUCKET_LABELS: Record<TaskDueBucket, string> = {
	completed: 'Completed',
	no_due_date: 'No due date',
	overdue: 'Overdue',
	due_today: 'Due today',
	due_this_week: 'Due this week',
	later: 'Later'
};

/** Calendar-day difference from today; `null` if there is no due date. */
export function getDaysUntilDue(dateString: string | null | undefined): number | null {
	if (dateString == null || dateString === '') return null;
	const dueDate = new Date(dateString);
	const today = new Date();
	dueDate.setHours(0, 0, 0, 0);
	today.setHours(0, 0, 0, 0);
	return Math.round((dueDate.getTime() - today.getTime()) / 86400000);
}

export function getTaskDueBucket(task: Task): TaskDueBucket {
	if (task.status === 'completed') return 'completed';
	const days = getDaysUntilDue(task.next_due_date ?? null);
	if (days === null) return 'no_due_date';
	if (days < 0) return 'overdue';
	if (days === 0) return 'due_today';
	if (days >= 1 && days <= 7) return 'due_this_week';
	return 'later';
}

export function compareTasksInBucket(a: Task, b: Task, bucket: TaskDueBucket): number {
	if (bucket === 'completed') {
		const ta = a.updated_at ? new Date(String(a.updated_at)).getTime() : 0;
		const tb = b.updated_at ? new Date(String(b.updated_at)).getTime() : 0;
		return tb - ta;
	}
	if (bucket === 'no_due_date') {
		return a.title.localeCompare(b.title);
	}
	const da = a.next_due_date ? new Date(a.next_due_date).getTime() : 0;
	const db = b.next_due_date ? new Date(b.next_due_date).getTime() : 0;
	return da - db;
}

export function groupTasksByBucket(tasks: Task[]): Map<TaskDueBucket, Task[]> {
	const map = new Map<TaskDueBucket, Task[]>();
	for (const b of BUCKET_ORDER) {
		map.set(b, []);
	}
	for (const task of tasks) {
		const b = getTaskDueBucket(task);
		map.get(b)!.push(task);
	}
	for (const b of BUCKET_ORDER) {
		map.get(b)!.sort((x, y) => compareTasksInBucket(x, y, b));
	}
	return map;
}

export function countByBucket(tasks: Task[]): Record<TaskDueBucket, number> {
	const counts: Record<TaskDueBucket, number> = {
		completed: 0,
		no_due_date: 0,
		overdue: 0,
		due_today: 0,
		due_this_week: 0,
		later: 0
	};
	for (const task of tasks) {
		counts[getTaskDueBucket(task)] += 1;
	}
	return counts;
}

export type DuePhraseTone = 'overdue' | 'today' | 'soon' | 'neutral' | 'muted' | 'completed';

export function formatShortDate(dateString: string): string {
	return new Date(dateString).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}

export function getDuePhrase(
	task: Task,
	bucket: TaskDueBucket
): { text: string; tone: DuePhraseTone } {
	if (bucket === 'completed') {
		if (task.next_due_date) {
			return {
				text: `Next due ${formatShortDate(task.next_due_date)}`,
				tone: 'completed'
			};
		}
		return { text: 'Completed', tone: 'completed' };
	}
	if (bucket === 'no_due_date') {
		return { text: 'No due date', tone: 'muted' };
	}
	const days = getDaysUntilDue(task.next_due_date ?? null);
	if (days === null) {
		return { text: 'No due date', tone: 'muted' };
	}
	if (days < 0) {
		return { text: `${Math.abs(days)} days overdue`, tone: 'overdue' };
	}
	if (days === 0) {
		return { text: 'Due today', tone: 'today' };
	}
	if (days === 1) {
		return { text: `Due tomorrow · ${formatShortDate(task.next_due_date!)}`, tone: 'soon' };
	}
	const tone: DuePhraseTone = days <= 7 ? 'soon' : 'neutral';
	return {
		text: `Due in ${days} days · ${formatShortDate(task.next_due_date!)}`,
		tone
	};
}

export function formatIntervalSummary(task: Task): string | null {
	const parts: string[] = [];
	if (task.usage_interval != null) {
		parts.push(`Every ${task.usage_interval} usage units`);
	}
	if (task.time_interval_days != null) {
		parts.push(`Every ${task.time_interval_days} days`);
	}
	return parts.length ? parts.join(' · ') : null;
}
