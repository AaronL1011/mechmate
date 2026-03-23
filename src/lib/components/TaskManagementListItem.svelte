<script lang="ts">
	import type { Task } from '$lib/types/db.js';
	import type { TaskDueBucket, DuePhraseTone } from '$lib/utils/taskBuckets.js';
	import { getDuePhrase, formatIntervalSummary } from '$lib/utils/taskBuckets.js';

	let {
		task,
		equipmentName,
		taskTypeName,
		bucket,
		onEdit,
		onDelete,
		onComplete
	}: {
		task: Task;
		equipmentName: string;
		taskTypeName: string;
		bucket: TaskDueBucket;
		onEdit: () => void;
		onDelete: () => void;
		onComplete: () => void;
	} = $props();

	let descriptionExpanded = $state(false);

	const priorityBorderClass: Record<Task['priority'], string> = {
		low: 'border-l-blue-500 dark:border-l-blue-400',
		medium: 'border-l-amber-500 dark:border-l-amber-400',
		high: 'border-l-orange-500 dark:border-l-orange-400',
		critical: 'border-l-red-600 dark:border-l-red-500'
	};

	const priorityChipClass: Record<Task['priority'], string> = {
		low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
		medium: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100',
		high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
		critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
	};

	const dueToneClass: Record<DuePhraseTone, string> = {
		overdue: 'font-medium text-red-700 dark:text-red-300',
		today: 'font-medium text-amber-700 dark:text-amber-300',
		soon: 'font-medium text-amber-800/90 dark:text-amber-200/90',
		neutral: 'text-gray-700 dark:text-gray-300',
		muted: 'text-gray-500 dark:text-gray-400',
		completed: 'text-gray-500 dark:text-gray-400'
	};

	const dueDisplay = $derived(getDuePhrase(task, bucket));
	const intervalLine = $derived(formatIntervalSummary(task));
	const showStatusChip = $derived(bucket !== 'overdue' && task.status === 'overdue');
	const canComplete = $derived(task.status !== 'completed');
	const hasDescription = $derived(Boolean(task.description?.trim()));
</script>

<li
	class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-600 dark:bg-gray-800 dark:shadow-gray-900/20 dark:hover:shadow-lg dark:hover:shadow-gray-900/30 {priorityBorderClass[
		task.priority
	]} border-l-4"
>
	<div class="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-5 sm:py-5">
		<div class="min-w-0 flex-1 space-y-2">
			<div class="flex flex-wrap items-center gap-2">
				<span
					class="inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize {priorityChipClass[
						task.priority
					]}"
				>
					{task.priority}
				</span>
				{#if showStatusChip}
					<span
						class="inline-flex shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-800 dark:bg-gray-700 dark:text-gray-200"
					>
						{task.status}
					</span>
				{/if}
			</div>

			<h3 class="truncate text-base font-semibold text-gray-900 dark:text-white sm:text-lg">
				{task.title}
			</h3>

			<p class={dueToneClass[dueDisplay.tone]}>{dueDisplay.text}</p>

			<p class="text-sm text-gray-500 dark:text-gray-400">
				{equipmentName}
				<span class="text-gray-400 dark:text-gray-500"> · </span>
				{taskTypeName}
			</p>

			{#if intervalLine}
				<p class="text-xs text-gray-400 dark:text-gray-500">{intervalLine}</p>
			{/if}

			{#if hasDescription}
				<div class="pt-1">
					<p
						class="text-sm text-gray-600 dark:text-gray-300 {descriptionExpanded
							? ''
							: 'line-clamp-2'}"
					>
						{task.description}
					</p>
					{#if (task.description?.length ?? 0) > 100}
						<button
							type="button"
							class="mt-1 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
							onclick={() => (descriptionExpanded = !descriptionExpanded)}
						>
							{descriptionExpanded ? 'Show less' : 'Show more'}
						</button>
					{/if}
				</div>
			{/if}
		</div>

		<div
			class="flex shrink-0 flex-wrap items-center gap-2 border-t border-gray-100 pt-3 sm:border-t-0 sm:pt-0 dark:border-gray-700"
		>
			{#if canComplete}
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-md border border-emerald-200/80 bg-white px-3 py-1.5 text-sm font-medium text-emerald-800 transition-colors hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-700/80 dark:bg-gray-800 dark:text-emerald-300 dark:hover:border-emerald-600 dark:hover:bg-gray-700"
					onclick={onComplete}
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
			{/if}
			<button
				type="button"
				class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
				onclick={onEdit}
			>
				Edit
			</button>
			<button
				type="button"
				class="rounded-md px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
				onclick={onDelete}
			>
				Delete
			</button>
		</div>
	</div>
</li>
