<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import type { Equipment, EquipmentType, TaskCompletion } from '$lib/types/db.js';
	import { formatCurrency, formatDate } from '$lib/utils/format';
	import { normalizePartsUsed } from '$lib/utils/parts.js';
	import { createReportHTML } from '$lib/utils/pdf';
	import EquipmentHistoryContent from './EquipmentHistoryContent.svelte';

	let equipment = $state<Equipment | null>(null);
	let completions = $state<TaskCompletion[]>([]);
	let equipmentTypes = $state<EquipmentType[]>([]);
	let loading = $state(true);
	let error = $state('');

	const equipmentId = $derived($page.params.id);

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
			...completions.map((completion) => {
				const partsCsv = normalizePartsUsed(completion.parts_used);
				return [
					formatDate(completion.completed_date),
					completion.task_title || 'N/A',
					completion.completed_usage_value
						? `${completion.completed_usage_value} ${equipment?.usage_unit || 'units'}`
						: 'N/A',
					completion.notes || 'N/A',
					completion.cost !== null && completion.cost !== undefined ? completion.cost : 'N/A',
					completion.service_provider || 'N/A',
					partsCsv.length ? partsCsv.join('; ') : 'N/A'
				]
					.map(csvValue)
					.join(',');
			})
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
	<title>{equipment?.name || 'Equipment'} · Service history</title>
</svelte:head>

<header class="mx-auto my-8 pl-4 max-w-7xl">
	<div class="mb-4 flex items-center gap-4">
		<a
			href="/equipment"
			class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
			aria-label="Back to equipment list"
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
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
				{equipment?.name || 'Equipment'}
			</h1>
			<p class="mt-1 text-gray-600 dark:text-gray-300">Service history</p>
		</div>
	</div>
</header>

<main class="mx-auto max-w-7xl">
	<EquipmentHistoryContent
		{loading}
		{error}
		{equipment}
		{completions}
		equipmentId={equipmentId ?? ''}
		{loadData}
		{exportToCSV}
		{exportToPDF}
		{getEquipmentTypeName}
	/>
</main>
