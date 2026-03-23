<script lang="ts">
	import type { Equipment } from '$lib/types/db.js';
	import type { TaskCompletion } from '$lib/types/db.js';
	import { formatCurrency, formatRelativeDay, formatShortDate } from '$lib/utils/format';
	import { normalizePartsUsed } from '$lib/utils/parts.js';

	interface Props {
		completions: TaskCompletion[];
		equipment: Equipment;
	}

	const { completions, equipment }: Props = $props();

	function secondaryLine(completion: TaskCompletion): string {
		const usage =
			completion.completed_usage_value != null && completion.completed_usage_value !== undefined
				? `${completion.completed_usage_value} ${equipment.usage_unit}`
				: 'N/A';
		const cost = completion.cost != null ? formatCurrency(completion.cost) : 'N/A';
		const provider = completion.service_provider?.trim() ? completion.service_provider : 'N/A';
		return [usage, cost, provider].join(' · ');
	}
</script>

{#if completions.length === 0}
	<div
		class="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-gray-900/20"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
			fill="currentColor"
			viewBox="0 0 256 256"
			><path
				d="M200,32H163.74a47.92,47.92,0,0,0-71.48,0H56A16,16,0,0,0,40,48V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm-72,0a32,32,0,0,1,32,32H96A32,32,0,0,1,128,32Zm72,184H56V48H82.75A47.93,47.93,0,0,0,80,64v8a8,8,0,0,0,8,8h80a8,8,0,0,0,8-8V64a47.93,47.93,0,0,0-2.75-16H200Z"
			></path></svg
		>
		<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">
			No maintenance history
		</h3>
		<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
			No completed maintenance tasks found for this equipment.
		</p>
	</div>
{:else}
	<div
		class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-gray-900/20"
	>
		<ul class="divide-y divide-gray-200 dark:divide-gray-700">
			{#each completions as completion (completion.id)}
				{@const partsList = normalizePartsUsed(completion.parts_used)}
				<li class="px-4 py-5 sm:px-6">
					<div class="flex flex-col gap-4 sm:flex-row sm:gap-6">
						<div class="shrink-0 border-l-4 border-emerald-500 pl-4 sm:w-40 sm:text-right">
							<p class="text-sm font-semibold text-gray-900 dark:text-white">
								{formatShortDate(completion.completed_date)}
							</p>
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								{formatRelativeDay(completion.completed_date)}
							</p>
						</div>
						<div class="min-w-0 flex-1">
							<h3 class="text-base font-semibold text-gray-900 dark:text-white">
								{completion.task_title || 'Unknown task'}
							</h3>
							<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
								{secondaryLine(completion)}
							</p>

							{#if completion.notes}
								<div
									class="mt-3 rounded-md border border-gray-100 bg-gray-50/80 px-3 py-2.5 dark:border-gray-600 dark:bg-gray-900/40"
								>
									<p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
										Notes
									</p>
									<p class="mt-1 text-sm text-gray-900 dark:text-gray-100">{completion.notes}</p>
								</div>
							{/if}

							{#if partsList.length > 0}
								<div
									class="mt-3 rounded-md border border-gray-100 bg-gray-50/80 px-3 py-2.5 dark:border-gray-600 dark:bg-gray-900/40"
								>
									<p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
										Parts
									</p>
									<div class="mt-2 flex flex-wrap gap-1.5">
										{#each partsList as part, partIndex (completion.id + '-' + partIndex)}
											<span
												class="inline-flex max-w-full break-words rounded-md bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
											>
												{part}
											</span>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					</div>
				</li>
			{/each}
		</ul>
	</div>
{/if}
