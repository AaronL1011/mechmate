<script lang="ts">
	import type { Equipment, EquipmentType, TaskCompletion } from '$lib/types/db.js';
	import { formatCurrency, formatDate } from '$lib/utils/format';
	import MaintenanceHistoryList from '$lib/components/MaintenanceHistoryList.svelte';

	interface Props {
		loading: boolean;
		error: string;
		equipment: Equipment | null;
		completions: TaskCompletion[];
		equipmentId: string;
		loadData: () => Promise<void>;
		exportToCSV: () => void;
		exportToPDF: () => void;
		getEquipmentTypeName: (id: number) => string;
	}

	const {
		loading,
		error,
		equipment,
		completions,
		equipmentId,
		loadData,
		exportToCSV,
		exportToPDF,
		getEquipmentTypeName
	}: Props = $props();
</script>

{#if loading}
	<div class="flex items-center justify-center py-12">
		<div
			class="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600 dark:border-blue-400"
		></div>
	</div>
{:else if error}
	<div
		class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:border-red-900/20"
	>
		<p class="text-red-800 dark:text-red-200">{error}</p>
		<button
			onclick={loadData}
			class="mt-2 text-red-600 underline hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
		>
			Try again
		</button>
	</div>
{:else if equipment}
	<div class="mb-8 rounded-lg bg-white p-6 shadow dark:bg-gray-800 dark:shadow-gray-900/20">
		<h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
			Equipment Information
		</h2>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#if (equipment as { total_cost?: number }).total_cost != null}
				<div>
					<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Total spent</p>
					<p class="text-gray-900 dark:text-white">
						${((equipment as { total_cost?: number }).total_cost ?? 0).toFixed(2)}
					</p>
				</div>
			{/if}
			<div>
				<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Type</p>
				<p class="text-gray-900 capitalize dark:text-white">
					{getEquipmentTypeName(equipment.equipment_type_id)}
				</p>
			</div>
			{#if equipment.make}
				<div>
					<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Make</p>
					<p class="text-gray-900 dark:text-white">{equipment.make}</p>
				</div>
			{/if}
			{#if equipment.model}
				<div>
					<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Model</p>
					<p class="text-gray-900 dark:text-white">{equipment.model}</p>
				</div>
			{/if}
			{#if equipment.year}
				<div>
					<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Year</p>
					<p class="text-gray-900 dark:text-white">{equipment.year}</p>
				</div>
			{/if}
			{#if (equipment as { location?: string | null }).location}
				<div>
					<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Location</p>
					<p class="text-gray-900 dark:text-white">{(equipment as { location?: string | null }).location}</p>
				</div>
			{/if}
			{#if equipment.serial_number}
				<div>
					<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Serial Number</p>
					<p class="text-gray-900 dark:text-white">{equipment.serial_number}</p>
				</div>
			{/if}
			<div>
				<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Current Usage</p>
				<p class="text-gray-900 dark:text-white">
					{equipment.current_usage_value}
					{equipment.usage_unit}
				</p>
			</div>
		</div>
	</div>

	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<h2 class="text-xl font-bold text-gray-900 lg:text-2xl dark:text-white">
			Maintenance History
		</h2>
		<div class="flex gap-2">
			<a
				href="/equipment/{equipmentId}/label"
				target="_blank"
				rel="noopener noreferrer"
				class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
			>
				Print label / QR
			</a>
			<div class="flex space-x-3">
				<button
					class="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
					onclick={exportToCSV}
					disabled={completions.length === 0}
				>
					Export to CSV
				</button>
				<button
					class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
					onclick={exportToPDF}
					disabled={completions.length === 0}
				>
					Export to PDF
				</button>
			</div>
		</div>
	</div>

	<MaintenanceHistoryList {completions} {equipment} />
{/if}
