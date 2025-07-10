<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import type { Equipment, EquipmentType, TaskCompletion } from '$lib/types/db.js';
	import { formatCurrency, formatDate } from '$lib/utils/format';
	import { createReportHTML } from '$lib/utils/pdf';

	let equipment: Equipment | null = null;
	let completions: TaskCompletion[] = [];
	let equipmentTypes: EquipmentType[] = [];
	let loading = true;
	let error = '';

	$: equipmentId = $page.params.id;

	async function loadData() {
		try {
			loading = true;
			const [equipmentRes, equipmentTypesRes, completionsRes] = await Promise.all([
				fetch(`/api/equipment/${equipmentId}`),
				fetch('/api/equipment-types'),
				fetch(`/api/equipment/${equipmentId}/completions`)
			]);

			if (!equipmentRes.ok || !equipmentTypesRes.ok || !completionsRes.ok) {
				throw new Error('Failed to load equipment data');
			}

			equipment = await equipmentRes.json();
			equipmentTypes = await equipmentTypesRes.json();
			completions = await completionsRes.json();
		} catch (err) {
			error = 'Failed to load maintenance history';
			console.error(err);
		} finally {
			loading = false;
		}
	}

	function exportToCSV() {
		if (!equipment || !completions.length) return;

		const headers = [
			'Date',
			'Task',
			'Usage at Completion',
			'Notes',
			'Cost',
			'Service Provider',
			'Parts Used'
		];

		// Helper to escape and quote CSV values
		function csvValue(val: string | number | null | undefined): string {
			if (val === null || val === undefined) return '""';
			const str = String(val).replace(/"/g, '""');
			return `"${str}"`;
		}

		const csvContent = [
			headers.map(csvValue).join(','),
			...completions.map((completion) =>
				[
					formatDate(completion.completed_date),
					completion.task_title || 'N/A',
					completion.completed_usage_value
						? `${completion.completed_usage_value} ${equipment?.usage_unit || 'units'}`
						: 'N/A',
					completion.notes || 'N/A',
					completion.cost !== null && completion.cost !== undefined ? completion.cost : 'N/A',
					completion.service_provider || 'N/A',
					completion.parts_used ? completion.parts_used.join('; ') : 'N/A'
				]
					.map(csvValue)
					.join(',')
			)
		].join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv' });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${equipment.name}_maintenance_history_${new Date().toISOString().split('T')[0]}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);
	}

	function exportToPDF() {
		if (!equipment || !completions.length) return;
		const equipmentTypeName = getEquipmentTypeName(equipment.equipment_type_id);

		// Create a simple HTML report that can be printed
		const reportHTML = createReportHTML(equipment, completions, equipmentTypeName);

		// Create a blob URL and open it in a new window
		const blob = new Blob([reportHTML], { type: 'text/html' });
		const url = window.URL.createObjectURL(blob);
		window.open(url, '_blank');

		// Clean up the blob URL after a delay
		setTimeout(() => {
			window.URL.revokeObjectURL(url);
		}, 1000);
	}

	onMount(() => {
		loadData();
	});

	function getEquipmentTypeName(equipmentTypeId: number): string {
		return equipmentTypes.find((e) => e.id === equipmentTypeId)?.name || 'Unknown';
	}
</script>

<svelte:head>
	<title>Maintenance History - {equipment?.name || 'Equipment'}</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8 dark:bg-gray-900">
	<!-- Header -->
	<header class="mx-auto mb-8 max-w-7xl">
		<div class="mb-4 flex items-center gap-4">
			<a
				href="/equipment"
				class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
				aria-label="return to dashboard"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					fill="currentColor"
					viewBox="0 0 256 256"
				>
					<path
						d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"
					></path>
				</svg>
			</a>
			<div>
				<h1 class="text-2xl font-bold text-gray-900 lg:text-3xl dark:text-white">
					Maintenance History
				</h1>
				<p class="text-gray-600 dark:text-gray-300">{equipment?.name || 'Equipment'}</p>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-7xl">
		{#if loading}
			<div class="flex items-center justify-center py-12">
				<div
					class="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600 dark:border-blue-400"
				></div>
			</div>
		{:else if error}
			<div
				class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
			>
				<p class="text-red-800 dark:text-red-200">{error}</p>
				<button
					on:click={loadData}
					class="mt-2 text-red-600 underline hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
				>
					Try again
				</button>
			</div>
		{:else if equipment}
			<!-- Equipment Info -->
			<div class="mb-8 rounded-lg bg-white p-6 shadow dark:bg-gray-800 dark:shadow-gray-900/20">
				<h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
					Equipment Information
				</h2>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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

			<!-- Export Buttons -->
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-xl font-bold text-gray-900 lg:text-2xl dark:text-white">
					Maintenance History
				</h2>
				<div class="flex space-x-3">
					<button
						class="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
						on:click={exportToCSV}
						disabled={completions.length === 0}
					>
						Export to CSV
					</button>
					<button
						class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
						on:click={exportToPDF}
						disabled={completions.length === 0}
					>
						Export to PDF
					</button>
				</div>
			</div>

			<!-- Maintenance History -->
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
		{/if}
	</main>
</div>
