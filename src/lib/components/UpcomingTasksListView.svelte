<script lang="ts">
	import type { Task, Equipment, DashboardStats, TaskType } from '$lib/types/db.js';
	import TaskTypeIcon from '$lib/components/TaskTypeIcon.svelte';
	import {
		BUCKET_LABELS,
		BUCKET_ORDER,
		compareTasksInBucket,
		getDuePhrase,
		getTaskDueBucket,
		type TaskDueBucket,
		type DuePhraseTone
	} from '$lib/utils/taskBuckets.js';

	let {
		upcomingTasks,
		stats,
		equipment,
		taskTypes = [],
		onCompleteTask,
		onAddEquipment,
		onAddTask
	}: {
		upcomingTasks: Task[];
		stats: DashboardStats | null;
		equipment: Equipment[];
		taskTypes?: TaskType[];
		onCompleteTask: (task: Task) => void;
		onAddEquipment: () => void;
		onAddTask: () => void;
	} = $props();

	const dueToneClass: Record<DuePhraseTone, string> = {
		overdue: 'text-sm font-medium text-red-700 dark:text-red-300',
		today: 'text-sm font-medium text-amber-700 dark:text-amber-300',
		soon: 'text-sm font-medium text-amber-800/90 dark:text-amber-200/90',
		neutral: 'text-sm font-medium text-gray-700 dark:text-gray-300',
		muted: 'text-sm text-gray-500 dark:text-gray-400',
		completed: 'text-sm text-gray-500 dark:text-gray-400'
	};

	const sortedTasks = $derived.by(() => {
		const list = [...upcomingTasks];
		list.sort((a, b) => {
			const ba = getTaskDueBucket(a);
			const bb = getTaskDueBucket(b);
			const ia = BUCKET_ORDER.indexOf(ba);
			const ib = BUCKET_ORDER.indexOf(bb);
			if (ia !== ib) return ia - ib;
			return compareTasksInBucket(a, b, ba);
		});
		return list;
	});

	function getEquipmentName(equipmentId: number): string {
		return equipment.find((e) => e.id === equipmentId)?.name || 'Unknown Equipment';
	}

	function getTaskTypeName(taskTypeId: number): string {
		return taskTypes.find((t) => t.id === taskTypeId)?.name ?? '';
	}

	const ctaButtonClass =
		'rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 sm:py-2';
</script>

{#if upcomingTasks.length === 0}
	<div
		class="rounded-lg bg-white p-10 text-center shadow dark:bg-gray-800 dark:shadow-gray-900/20 sm:p-12"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
			fill="currentColor"
			viewBox="0 0 256 256"
			aria-hidden="true"
			><path
				d="M200,32H163.74a47.92,47.92,0,0,0-71.48,0H56A16,16,0,0,0,40,48V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm-72,0a32,32,0,0,1,32,32H96A32,32,0,0,1,128,32Zm72,184H56V48H82.75A47.93,47.93,0,0,0,80,64v8a8,8,0,0,0,8,8h80a8,8,0,0,0,8-8V64a47.93,47.93,0,0,0-2.75-16H200Z"
			></path></svg
		>
		<h3 class="mt-3 text-base font-semibold text-gray-900 dark:text-white">No upcoming maintenance</h3>
		{#if stats && stats.total_tasks > 0}
			<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">You're all up to date.</p>
		{:else}
			<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
				Add equipment, then tasks, to see them here.
			</p>
			<div
				class="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center"
			>
				<button
					type="button"
					class="{ctaButtonClass} bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
					disabled={!stats}
					onclick={onAddEquipment}
				>
					{stats?.total_equipment === 0 ? 'Add your first equipment' : 'Add equipment'}
				</button>
				<button
					type="button"
					class="{ctaButtonClass} bg-emerald-600 text-white hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-40 dark:bg-emerald-700 dark:hover:bg-emerald-600"
					disabled={!stats || (stats !== null && stats.total_equipment === 0)}
					onclick={onAddTask}
				>
					Add your first task
				</button>
			</div>
		{/if}
	</div>
{:else}
	<div
		class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800 dark:shadow-gray-900/20"
	>
		<ul class="divide-y divide-gray-200 dark:divide-gray-700" role="list">
			{#each sortedTasks as task, taskIndex (task.id)}
				{@const bucket = getTaskDueBucket(task)}
				{@const prevBucket: TaskDueBucket | null =
					taskIndex > 0 ? getTaskDueBucket(sortedTasks[taskIndex - 1]!) : null}
				{@const showBucketLabel = bucket !== prevBucket}
				{@const dueDisplay = getDuePhrase(task, bucket)}
				{@const isOverdue = bucket === 'overdue'}
				{@const taskTypeName = getTaskTypeName(task.task_type_id)}

				{#if showBucketLabel}
					<li
						class="list-none border-b border-gray-100 bg-gray-50/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400"
					>
						{BUCKET_LABELS[bucket]}
					</li>
				{/if}

				<li
					class="transition-colors {isOverdue
						? 'bg-red-50/35 dark:bg-red-950/25'
						: 'hover:bg-gray-50/80 dark:hover:bg-gray-700/40'}"
				>
					<div
						class="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4"
					>
						<div class="flex min-w-0 gap-3">
							<div
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"
								aria-hidden="true"
							>
								<TaskTypeIcon taskTypeId={task.task_type_id} />
							</div>
							<div class="min-w-0 flex-1">
								<p class={dueToneClass[dueDisplay.tone]}>{dueDisplay.text}</p>
								<h3 class="mt-0.5 truncate text-base font-semibold text-gray-900 dark:text-white">
									{task.title}
								</h3>
								<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
									<a
										href="/equipment/{task.equipment_id}/history"
										class="text-blue-600 hover:underline dark:text-blue-400"
									>
										{getEquipmentName(task.equipment_id)}
									</a>
									{#if taskTypeName}
										<span class="text-gray-400 dark:text-gray-500"> · </span>
										{taskTypeName}
									{/if}
								</p>
							</div>
						</div>
						<div
							class="flex w-full shrink-0 justify-end sm:w-auto dark:border-gray-700"
						>
							<button
								type="button"
								class="inline-flex items-center gap-1.5 rounded-md border border-emerald-200/80 bg-white px-3 py-1.5 text-sm font-medium text-emerald-800 transition-colors hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 focus-visible:ring-offset-2 dark:border-emerald-700/80 dark:bg-gray-800 dark:text-emerald-300 dark:hover:border-emerald-600 dark:hover:bg-gray-700 dark:focus-visible:ring-offset-gray-900"
								onclick={() => onCompleteTask(task)}
							>
								<svg
									class="h-4 w-4 shrink-0 opacity-90"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									></path>
								</svg>
								Complete
							</button>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	</div>
{/if}
