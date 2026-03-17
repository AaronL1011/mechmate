<script lang="ts">
	import type { Equipment } from '$lib/types/db.js';
	import type { TaskCompletion } from '$lib/types/db.js';
	import { formatCurrency, formatDate } from '$lib/utils/format';

	interface Props {
		completions: TaskCompletion[];
		equipment: Equipment;
	}

	const { completions, equipment }: Props = $props();
</script>

{#if completions.length === 0}
	<div
		class="rounded-lg bg-white p-12 text-center shadow dark:bg-gray-800 dark:shadow-gray-900/20"
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
		class="overflow-hidden bg-white shadow sm:rounded-md dark:bg-gray-800 dark:shadow-gray-900/20"
	>
		<ul class="divide-y divide-gray-200 dark:divide-gray-700">
			{#each completions as completion (completion.id)}
				<li class="px-6 py-4">
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<div class="mb-2 flex items-center space-x-2">
								<h3 class="text-lg font-medium text-gray-900 dark:text-white">
									{completion.task_title || 'Unknown Task'}
								</h3>
								<span
									class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-200"
								>
									Completed
								</span>
							</div>

							<div class="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
								<div>
									<p class="text-gray-600 dark:text-gray-300">Date</p>
									<p class="text-gray-900 dark:text-white">
										{formatDate(completion.completed_date)}
									</p>
								</div>

								<div>
									<p class="text-gray-600 dark:text-gray-300">Usage at Completion</p>
									<p class="text-gray-900 dark:text-white">
										{completion.completed_usage_value
											? `${completion.completed_usage_value} ${equipment.usage_unit}`
											: 'N/A'}
									</p>
								</div>

								<div>
									<p class="text-gray-600 dark:text-gray-300">Cost</p>
									<p class="text-gray-900 dark:text-white">
										{completion.cost ? formatCurrency(completion.cost) : 'N/A'}
									</p>
								</div>

								<div>
									<p class="text-gray-600 dark:text-gray-300">Service Provider</p>
									<p class="text-gray-900 dark:text-white">
										{completion.service_provider || 'N/A'}
									</p>
								</div>
							</div>

							{#if completion.notes}
								<div class="mt-3">
									<p class="text-sm text-gray-600 dark:text-gray-300">Notes</p>
									<p class="text-sm text-gray-900 dark:text-white">{completion.notes}</p>
								</div>
							{/if}

							{#if completion.parts_used && completion.parts_used.length > 0}
								<div class="mt-3">
									<p class="text-sm text-gray-600 dark:text-gray-300">Parts Used</p>
									<div class="mt-1 flex flex-wrap gap-1">
										{#each completion.parts_used as part (part)}
											<span
												class="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
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
