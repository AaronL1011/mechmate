<script lang="ts">
	import type { Equipment, TaskCompletion } from '$lib/types/db.js';
	import { formatCurrency, formatDate } from '$lib/utils/format';
	import MaintenanceHistoryList from '$lib/components/MaintenanceHistoryList.svelte';

	type EquipmentWithTotal = Equipment & { total_cost?: number };

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

	const recordCount = $derived(completions.length);
	const lastServiceLabel = $derived(
		completions[0]?.completed_date ? formatDate(completions[0].completed_date) : '—'
	);
	const lifetimeCostLabel = $derived(
		equipment != null && (equipment as EquipmentWithTotal).total_cost != null
			? formatCurrency((equipment as EquipmentWithTotal).total_cost ?? null)
			: '—'
	);
	const currentUsageLabel = $derived(
		equipment ? `${equipment.current_usage_value} ${equipment.usage_unit}` : '—'
	);

	const identityLine = $derived(
		equipment
			? [equipment.make, equipment.model, equipment.year ? String(equipment.year) : null]
					.filter(Boolean)
					.join(' · ')
			: ''
	);
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
	<section aria-label="Summary" class="mb-6">
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
			<div
				class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-gray-900/20"
			>
				<p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
					Records
				</p>
				<p class="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">
					{recordCount}
				</p>
			</div>
			<div
				class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-gray-900/20"
			>
				<p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
					Last service
				</p>
				<p class="mt-1 text-lg font-semibold leading-snug text-gray-900 dark:text-white">
					{lastServiceLabel}
				</p>
			</div>
			<div
				class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-gray-900/20"
			>
				<p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
					Lifetime service cost
				</p>
				<p class="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">
					{lifetimeCostLabel}
				</p>
			</div>
			<div
				class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-gray-900/20"
			>
				<p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
					Current usage
				</p>
				<p class="mt-1 text-lg font-semibold leading-snug text-gray-900 dark:text-white">
					{currentUsageLabel}
				</p>
			</div>
		</div>
	</section>

	<section
		class="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800 dark:shadow-gray-900/20"
		aria-labelledby="equipment-details-heading"
	>
		<h2 id="equipment-details-heading" class="mb-5 text-lg font-semibold text-gray-900 dark:text-white">
			Equipment details
		</h2>

		<div class="space-y-6">
			<div>
				<h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
					Identity
				</h3>
				<div class="space-y-3">
					<span
						class="inline-flex rounded-md bg-gray-200/80 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-gray-600 dark:bg-gray-600/60 dark:text-gray-300"
					>
						{getEquipmentTypeName(equipment.equipment_type_id)}
					</span>
					{#if identityLine}
						<p class="text-sm text-gray-900 dark:text-white">{identityLine}</p>
					{/if}
					<dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						{#if equipment.serial_number}
							<div>
								<dt class="text-sm font-medium text-gray-600 dark:text-gray-300">Serial number</dt>
								<dd class="mt-0.5 text-gray-900 dark:text-white">{equipment.serial_number}</dd>
							</div>
						{/if}
						{#if equipment.location}
							<div>
								<dt class="text-sm font-medium text-gray-600 dark:text-gray-300">Location</dt>
								<dd class="mt-0.5 text-gray-900 dark:text-white">{equipment.location}</dd>
							</div>
						{/if}
					</dl>
				</div>
			</div>
		</div>
	</section>

	<div
		class="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
	>
		<div class="flex flex-wrap items-center gap-2">
			<a
				href="/equipment/{equipmentId}/label"
				target="_blank"
				rel="noopener noreferrer"
				class="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
			>
				Print label / QR
			</a>
			<button
				type="button"
				class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
				onclick={exportToCSV}
				disabled={completions.length === 0}
			>
				Export CSV
			</button>
			<button
				type="button"
				class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
				onclick={exportToPDF}
				disabled={completions.length === 0}
			>
				Export PDF
			</button>
		</div>
	</div>

	<section aria-labelledby="service-log-heading">
		<h2 id="service-log-heading" class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
			Service log
		</h2>
		<MaintenanceHistoryList {completions} {equipment} />
	</section>
{/if}
