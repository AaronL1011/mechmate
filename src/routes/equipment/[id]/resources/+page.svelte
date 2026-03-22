<script lang="ts">
	import { page } from '$app/stores';
	import type { Equipment } from '$lib/types/db.js';
	import EquipmentSubNav from '$lib/components/EquipmentSubNav.svelte';
	import EquipmentResourcesPanel from '$lib/components/EquipmentResourcesPanel.svelte';

	let equipment = $state<Equipment | null>(null);
	let loading = $state(true);

	const equipmentId = $derived($page.params.id ?? '');

	async function loadEquipment() {
		if (!equipmentId) return;
		try {
			loading = true;
			const res = await fetch(`/api/equipment/${equipmentId}`);
			if (res.ok) equipment = await res.json();
		} catch (e) {
			console.error(e);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (!equipmentId) return;
		loadEquipment();
	});
</script>

<svelte:head>
	<title>{equipment?.name || 'Equipment'} · Resources</title>
</svelte:head>

{#if loading && !equipment}
	<div class="mx-auto max-w-7xl py-16 pl-4 text-gray-500 dark:text-gray-400">Loading…</div>
{:else}
	<EquipmentSubNav
		{equipmentId}
		equipmentName={equipment?.name || 'Equipment'}
		current="resources"
	/>
	<main>
		<EquipmentResourcesPanel {equipmentId} />
	</main>
{/if}
