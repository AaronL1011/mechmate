<script lang="ts">
	import { onDestroy } from 'svelte';
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

	let actionsMenuOpen = false;

	function teardownActionListeners() {
		document.removeEventListener('click', handleActionsClickOutside, true);
		document.removeEventListener('keydown', handleActionsEscape);
	}

	function closeActionsMenu() {
		actionsMenuOpen = false;
		teardownActionListeners();
	}

	function handleActionsClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.equipment-card-actions-menu')) {
			closeActionsMenu();
		}
	}

	function handleActionsEscape(event: KeyboardEvent) {
		if (event.key === 'Escape' && actionsMenuOpen) {
			closeActionsMenu();
		}
	}

	function toggleActionsMenu(event: MouseEvent) {
		event.stopPropagation();
		if (actionsMenuOpen) {
			closeActionsMenu();
			return;
		}
		actionsMenuOpen = true;
		queueMicrotask(() => {
			document.addEventListener('click', handleActionsClickOutside, true);
			document.addEventListener('keydown', handleActionsEscape);
		});
	}

	onDestroy(() => {
		teardownActionListeners();
	});

	const focusRingClass =
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800';

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

	function nextDueDetail(summary: NonNullable<typeof equipment.next_due_summary>): string {
		if (summary.next_due_date) {
			return formatDate(summary.next_due_date);
		}
		if (summary.next_due_usage_value != null) {
			return `${summary.next_due_usage_value} ${equipment.usage_unit}`;
		}
		return '';
	}
</script>

<li
	class="overflow-visible rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-600 dark:bg-gray-800 dark:shadow-gray-900/20 dark:hover:shadow-lg dark:hover:shadow-gray-900/30"
>
	<div
		class="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-5 sm:py-5"
	>
		<div class="min-w-0 min-h-0 flex-1 space-y-4">
			<div class="space-y-3">
				<div class="flex flex-wrap items-center gap-2">
					<span
						class="inline-flex shrink-0 rounded-md bg-gray-200/80 px-2 py-0.5 text-xs font-medium tracking-wide text-gray-600 uppercase dark:bg-gray-600/60 dark:text-gray-300"
					>
						{getEquipmentTypeName(equipment.equipment_type_id)}
					</span>
				</div>

				<h3 class="min-w-0 text-base font-semibold text-gray-900 sm:text-lg dark:text-white">
					<a
						href="/equipment/{equipment.id}/history"
						class="block truncate text-inherit transition-colors hover:text-blue-600 dark:hover:text-blue-400 {focusRingClass} rounded-sm"
					>
						{equipment.name}
					</a>
				</h3>

				{#if equipment.make || equipment.model || equipment.year}
					<p class="text-sm text-gray-500 dark:text-gray-400">
						{[equipment.make, equipment.model, equipment.year ? String(equipment.year) : null]
							.filter(Boolean)
							.join(' · ')}
					</p>
				{/if}
			</div>

			{#if equipment.next_due_summary}
				{@const nextDueLine = nextDueDetail(equipment.next_due_summary)}
				<div
					class="rounded-lg border border-amber-200 bg-amber-50/90 p-3 dark:border-amber-800/50 dark:bg-amber-900/25"
				>
					<div class="flex items-center gap-1.5 text-xs font-medium tracking-wider text-amber-800/90 uppercase dark:text-amber-200/90">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-3.5 w-3.5 shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						Next due
					</div>
					<p class="mt-1.5 truncate text-sm font-medium text-amber-950 dark:text-amber-100">
						{equipment.next_due_summary.next_due_task_title}
					</p>
					{#if nextDueLine}
						<p class="mt-0.5 text-xs text-amber-900/90 dark:text-amber-200/90">
							{nextDueLine}
						</p>
					{/if}
				</div>
			{/if}

			<div
				class="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 pt-4 sm:grid-cols-3 dark:border-gray-700"
			>
				<div class="min-w-0">
					<span
						class="block text-xs font-medium tracking-wider text-gray-400 uppercase dark:text-gray-500"
						>Usage</span
					>
					<span
						class="mt-0.5 block text-sm font-medium text-gray-700 tabular-nums dark:text-gray-200"
					>
						{equipment.current_usage_value}
						<span class="font-normal text-gray-500 dark:text-gray-400">{equipment.usage_unit}</span>
					</span>
				</div>
				<div class="min-w-0">
					<span
						class="block text-xs font-medium tracking-wider text-gray-400 uppercase dark:text-gray-500"
						>Spent</span
					>
					<span
						class="mt-0.5 block text-sm font-medium text-gray-700 tabular-nums dark:text-gray-200"
					>
						${(equipment.total_cost ?? 0).toFixed(2)}
					</span>
				</div>
				{#if equipment.purchase_date}
					<div class="min-w-0 sm:col-span-1">
						<span
							class="block text-xs font-medium tracking-wider text-gray-400 uppercase dark:text-gray-500"
							>Purchased</span
						>
						<span class="mt-0.5 block text-sm text-gray-600 dark:text-gray-300">
							{formatDate(equipment.purchase_date)}
						</span>
					</div>
				{/if}
			</div>

			{#if equipment.location || equipment.serial_number}
				<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
					{#if equipment.location}
						<span class="flex min-w-0 items-center gap-1">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-3.5 w-3.5 shrink-0"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								aria-hidden="true"
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
							<span class="min-w-0 break-words">{equipment.location}</span>
						</span>
					{/if}
					{#if equipment.serial_number}
						<span class="flex min-w-0 items-center gap-1">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-3.5 w-3.5 shrink-0"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								aria-hidden="true"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
								/>
							</svg>
							<span class="min-w-0 break-words">{equipment.serial_number}</span>
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

		<div
			class="flex w-full shrink-0 flex-wrap content-start items-center justify-start gap-2 border-t border-gray-100 pt-3 sm:w-auto sm:justify-end sm:border-t-0 sm:pt-0 dark:border-gray-700"
		>
			<a
				href="/equipment/{equipment.id}/history"
				class="inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 sm:min-h-10 dark:bg-blue-700 dark:hover:bg-blue-600 {focusRingClass}"
			>
				Service history
			</a>
			<a
				href="/equipment/{equipment.id}/resources"
				class="inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:min-h-10 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 {focusRingClass}"
			>
				Resources
			</a>

			<div class="equipment-card-actions-menu relative inline-flex shrink-0">
				<button
					type="button"
					class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 sm:min-h-10 sm:min-w-10 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 {focusRingClass}"
					aria-label="Settings and actions for {equipment.name}"
					aria-expanded={actionsMenuOpen}
					aria-haspopup="menu"
					onclick={toggleActionsMenu}
				>
					<svg
						class="h-5 w-5 shrink-0"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
						/>
					</svg>
				</button>

				{#if actionsMenuOpen}
					<div
						class="absolute top-full right-0 z-50 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
						role="menu"
						aria-label="Equipment actions"
					>
						<button
							type="button"
							class="flex w-full items-center px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
							role="menuitem"
							onclick={() => {
								onEdit(equipment);
								closeActionsMenu();
							}}
						>
							Edit
						</button>
						<div
							class="my-1 border-t border-gray-100 dark:border-gray-700"
							role="presentation"
							aria-hidden="true"
						></div>
						<button
							type="button"
							class="flex w-full items-center px-4 py-2.5 text-left text-sm text-red-700 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
							role="menuitem"
							onclick={() => {
								onDelete(equipment);
								closeActionsMenu();
							}}
						>
							Delete
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</li>
