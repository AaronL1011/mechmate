<script lang="ts">
	import { onMount } from 'svelte';
	import type { Task, Equipment } from '$lib/types/db.js';

	let {
		upcomingTasks,
		equipment,
		onCompleteTask
	}: {
		upcomingTasks: Task[];
		equipment: Equipment[];
		onCompleteTask: (task: Task) => void;
	} = $props();

	let currentDate = $state(new Date());
	let calendarDays: Date[] = $state([]);

	function getDaysInMonth(year: number, month: number): number {
		return new Date(year, month + 1, 0).getDate();
	}

	function getFirstDayOfMonth(year: number, month: number): number {
		return new Date(year, month, 1).getDay();
	}

	function generateCalendarDays(date: Date): Date[] {
		const year = date.getFullYear();
		const month = date.getMonth();
		const daysInMonth = getDaysInMonth(year, month);
		const firstDayOfMonth = getFirstDayOfMonth(year, month);

		const days: Date[] = [];

		const prevMonth = month === 0 ? 11 : month - 1;
		const prevYear = month === 0 ? year - 1 : year;
		const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

		for (let i = firstDayOfMonth - 1; i >= 0; i--) {
			days.push(new Date(prevYear, prevMonth, daysInPrevMonth - i));
		}

		for (let day = 1; day <= daysInMonth; day++) {
			days.push(new Date(year, month, day));
		}

		const nextMonth = month === 11 ? 0 : month + 1;
		const nextYear = month === 11 ? year + 1 : year;
		const remainingDays = 42 - days.length;

		for (let day = 1; day <= remainingDays; day++) {
			days.push(new Date(nextYear, nextMonth, day));
		}

		return days;
	}

	function isSameDay(date1: Date, date2: Date): boolean {
		return (
			date1.getFullYear() === date2.getFullYear() &&
			date1.getMonth() === date2.getMonth() &&
			date1.getDate() === date2.getDate()
		);
	}

	function isToday(date: Date): boolean {
		return isSameDay(date, new Date());
	}

	function isCurrentMonth(date: Date): boolean {
		return (
			date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear()
		);
	}

	function getEquipmentName(equipmentId: number): string {
		return equipment.find((e) => e.id === equipmentId)?.name || 'Unknown Equipment';
	}

	function getTasksForDate(date: Date): Task[] {
		return upcomingTasks.filter((task) => {
			if (!task.next_due_date) return false;
			const taskDate = new Date(task.next_due_date);
			return isSameDay(taskDate, date);
		});
	}

	function getDayClass(date: Date): string {
		const baseClass = 'h-24 border hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors';
		const isCurrentDay = isToday(date);
		const isCurrentMonthDay = isCurrentMonth(date);
		const tasks = getTasksForDate(date);
		const overdueTasks = tasks.filter((task) => {
			if (!task.next_due_date) return false;
			return new Date(task.next_due_date) < new Date();
		});

		if (!isCurrentMonthDay) {
			return `${baseClass} bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700`;
		}

		if (isCurrentDay) {
			return `${baseClass} bg-blue-100 dark:bg-blue-900/30 border-blue-400 dark:border-blue-500`;
		}

		if (overdueTasks.length > 0) {
			return `${baseClass} bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-600`;
		}

		if (tasks.length > 0) {
			return `${baseClass} bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-600`;
		}

		return `${baseClass} border-gray-200 dark:border-gray-700`;
	}

	function previousMonth() {
		currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
		calendarDays = generateCalendarDays(currentDate);
	}

	function nextMonth() {
		currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
		calendarDays = generateCalendarDays(currentDate);
	}

	onMount(() => {
		calendarDays = generateCalendarDays(currentDate);
	});
</script>

<div class="rounded-lg bg-white shadow dark:bg-gray-800 dark:shadow-gray-900/20">
	<div class="border-b border-gray-200 p-6 dark:border-gray-700">
		<div class="flex items-center justify-between">
			<div class="flex space-x-2 w-full justify-between">
				<button
					onclick={previousMonth}
					class="rounded bg-gray-100 px-3 py-1 text-sm transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
				>
					←
				</button>
				<span class="px-4 py-1 text-sm font-medium text-gray-900 dark:text-white">
					{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
				</span>
				<button
					onclick={nextMonth}
					class="rounded bg-gray-100 px-3 py-1 text-sm transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
				>
					→
				</button>
			</div>
		</div>
	</div>

	<div class="p-0 lg:p-6">
		<div class="grid grid-cols-7 gap-0 lg:gap-1">
			{#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day (day)}
				<div
					class="flex h-8 items-center justify-center text-sm font-medium text-gray-500 dark:text-gray-400"
				>
					{day}
				</div>
			{/each}

			{#each calendarDays as day (day.toISOString())}
				<div class={getDayClass(day)}>
					<div class="m-1 mr-0 text-sm font-medium">
						{day.getDate()}
					</div>
					<div class="space-y-1">
						{#each getTasksForDate(day) as task (task.id)}
							{@const isOverdue =
								task.next_due_date && new Date(task.next_due_date) < new Date()}
							<div
								aria-label="Complete task"
								role="button"
								tabindex="0"
								onkeydown={(e) => e.key === 'Enter' && onCompleteTask(task)}
								class="cursor-pointer truncate rounded p-1 text-xs transition-colors {isOverdue
									? 'bg-red-200 text-red-800 hover:bg-red-300 dark:bg-red-900/30 dark:text-red-200 dark:hover:bg-red-900/50'
									: 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200 dark:hover:bg-yellow-900/50'}"
								onclick={() => onCompleteTask(task)}
								title="{task.title} - {getEquipmentName(task.equipment_id)}"
							>
								{task.title} - {getEquipmentName(task.equipment_id)}
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
