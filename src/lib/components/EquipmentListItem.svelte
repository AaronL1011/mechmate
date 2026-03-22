<script lang="ts">
	import type { Equipment, EquipmentType } from '$lib/types/db.js';

	export let equipment: Equipment & {
		total_cost?: number;
		next_due_summary?: {
			next_due_task_title: string;
			next_due_date?: string | null;
			next_due_usage_value?: number | null;
		} | null;
	};
	export let equipmentTypes: EquipmentType[];
	export let onEdit: (equipment: Equipment) => void;
	export let onDelete: (equipment: Equipment) => void;

	function formatDate(dateString: string | null): string {
		if (!dateString) return 'Not specified';
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function parseTags(tags: string | null): string[] {
		if (!tags) return [];
		try {
			return JSON.parse(tags);
		} catch {
			return [];
		}
	}

	function getEquipmentTypeName(equipmentTypeId: number): string {
		return equipmentTypes.find((e) => e.id === equipmentTypeId)?.name || 'Unknown';
	}
</script>

<li
	class="overflow-hidden rounded-lg bg-white px-5 py-5 shadow transition-shadow hover:shadow-md sm:px-6 dark:bg-gray-800 dark:shadow-gray-900/20 dark:hover:shadow-lg dark:hover:shadow-gray-900/30"
>
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
		<div class="min-w-0 flex-1 space-y-4">
			<div class="flex flex-col gap-3">
				<div class="flex min-w-0 items-start justify-between gap-3">
					<div class="min-w-0 flex-1">
						<div class="mb-1.5 flex flex-wrap items-center gap-2">
							<span
								class="inline-flex shrink-0 rounded-md bg-gray-200/80 px-2 py-0.5 text-xs font-medium tracking-wide text-gray-600 uppercase dark:bg-gray-600/60 dark:text-gray-300"
							>
								{getEquipmentTypeName(equipment.equipment_type_id)}
							</span>
						</div>
						<h3 class="text-base font-semibold text-gray-900 sm:text-lg dark:text-white">
							{equipment.name}
						</h3>
						{#if equipment.make || equipment.model || equipment.year}
							<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
								{[equipment.make, equipment.model, equipment.year ? String(equipment.year) : null]
									.filter(Boolean)
									.join(' · ')}
							</p>
						{/if}
					</div>
					<div class="flex shrink-0 items-center gap-2">
						<a
							href="/equipment/{equipment.id}/history"
							class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
						>
							Resources
						</a>
						<button
							class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
							on:click={() => onEdit(equipment)}
						>
							Edit
						</button>
						<button
							class="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300"
							on:click={() => onDelete(equipment)}
						>
							Delete
						</button>
					</div>
				</div>
				{#if equipment.next_due_summary}
					<div class="w-full">
						<span
							class="inline-flex w-auto items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/30 dark:text-amber-200"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-3.5 w-3.5 shrink-0"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							{equipment.next_due_summary.next_due_task_title}
							{#if equipment.next_due_summary.next_due_date}
								— {formatDate(equipment.next_due_summary.next_due_date)}
							{:else if equipment.next_due_summary.next_due_usage_value != null}
								— {equipment.next_due_summary.next_due_usage_value}
								{equipment.usage_unit}
							{/if}
						</span>
					</div>
				{/if}
			</div>

			<div
				class="flex flex-wrap gap-x-6 gap-y-3 border-t border-gray-100 pt-4 dark:border-gray-700"
			>
				<div class="flex items-baseline gap-1.5">
					<span
						class="text-xs font-medium tracking-wider text-gray-400 uppercase dark:text-gray-500"
						>Usage</span
					>
					<span class="text-sm font-medium text-gray-700 tabular-nums dark:text-gray-200">
						{equipment.current_usage_value}
						<span class="font-normal text-gray-500 dark:text-gray-400">{equipment.usage_unit}</span>
					</span>
				</div>
				<div class="flex items-baseline gap-1.5">
					<span
						class="text-xs font-medium tracking-wider text-gray-400 uppercase dark:text-gray-500"
						>Spent</span
					>
					<span class="text-sm font-medium text-gray-700 tabular-nums dark:text-gray-200">
						${(equipment.total_cost ?? 0).toFixed(2)}
					</span>
				</div>
				{#if equipment.purchase_date}
					<div class="flex items-baseline gap-1.5">
						<span
							class="text-xs font-medium tracking-wider text-gray-400 uppercase dark:text-gray-500"
							>Purchased</span
						>
						<span class="text-sm text-gray-600 dark:text-gray-300">
							{formatDate(equipment.purchase_date)}
						</span>
					</div>
				{/if}
			</div>

			{#if equipment.location || equipment.serial_number}
				<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
					{#if equipment.location}
						<span class="flex items-center gap-1">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-3.5 w-3.5 shrink-0"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
								/>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
								/>
							</svg>
							{equipment.location}
						</span>
					{/if}
					{#if equipment.serial_number}
						<span class="flex items-center gap-1">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-3.5 w-3.5 shrink-0"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
								/>
							</svg>
							{equipment.serial_number}
						</span>
					{/if}
				</div>
			{/if}

			{#if equipment.tags}
				{@const tags = parseTags(equipment.tags)}
				{#if tags.length > 0}
					<div class="flex flex-wrap gap-1.5">
						{#each tags as tag (tag)}
							<span
								class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300"
							>
								{tag}
							</span>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</li>
