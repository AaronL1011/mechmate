<script lang="ts">
	import { onMount } from 'svelte';
	import type { Equipment, EquipmentType } from '$lib/types/db.js';
	import EditEquipmentModal from '$lib/components/EditEquipmentModal.svelte';
	import DeleteConfirmationModal from '$lib/components/DeleteConfirmationModal.svelte';
	import EquipmentListItem from '$lib/components/EquipmentListItem.svelte';

	let equipment: Equipment[] = [];
	let equipmentTypes: EquipmentType[] = [];
	let loading = true;
	let error = '';

	// Modal states
	let showEditModal = false;
	let showDeleteModal = false;
	let selectedEquipment: Equipment | null = null;

	async function loadEquipment() {
		try {
			loading = true;
			const [equipmentRes, equipmentTypesRes] = await Promise.all([
				fetch('/api/equipment'),
				fetch('/api/equipment-types')
			]);

			if (!equipmentRes.ok || !equipmentTypesRes.ok) {
				throw new Error('Failed to load equipment');
			}

			equipment = await equipmentRes.json();
			equipmentTypes = await equipmentTypesRes.json();
		} catch (err) {
			error = 'Failed to load equipment data';
			console.error(err);
		} finally {
			loading = false;
		}
	}

	function openEditModal(equipmentItem: Equipment) {
		selectedEquipment = equipmentItem;
		showEditModal = true;
	}

	function openDeleteModal(equipmentItem: Equipment) {
		selectedEquipment = equipmentItem;
		showDeleteModal = true;
	}

	function handleEquipmentUpdated(updatedEquipment: Equipment) {
		equipment = equipment.map((eq) => (eq.id === updatedEquipment.id ? updatedEquipment : eq));
		showEditModal = false;
		selectedEquipment = null;
	}

	function handleEquipmentDeleted(event: CustomEvent) {
		const deletedId = event.detail;
		equipment = equipment.filter((eq) => eq.id !== deletedId);
		showDeleteModal = false;
		selectedEquipment = null;
	}

	async function handleDeleteConfirm() {
		if (!selectedEquipment) return;

		try {
			const response = await fetch(`/api/equipment/${selectedEquipment.id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to delete equipment');
			}

			handleEquipmentDeleted({ detail: selectedEquipment.id } as CustomEvent);
		} catch (err) {
			console.error('Error deleting equipment:', err);
			// You could show an error message here
		}
	}

	onMount(() => {
		loadEquipment();
	});
</script>

<svelte:head>
	<title>Equipment Management - Mechmate</title>
</svelte:head>

<header class="mx-auto my-8 pl-4 max-w-7xl">
	<h1 class="text-xl font-bold text-gray-900 lg:text-3xl dark:text-white">Equipment Management</h1>
	<p class="mt-1 text-sm text-gray-600 lg:text-base dark:text-gray-300">
		Track inventory and export service history
	</p>
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
					on:click={loadEquipment}
					class="mt-2 text-red-600 underline hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
				>
					Try again
				</button>
			</div>
		{:else if equipment.length === 0}
			<div
				class="rounded-lg bg-white p-12 text-center shadow dark:bg-gray-800 dark:shadow-gray-900/20"
			>
				<!-- <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 256 256"><path d="M208,88H48a16,16,0,0,0-16,16v96a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V104A16,16,0,0,0,208,88Zm0,112H48V104H208v96ZM48,64a8,8,0,0,1,8-8H200a8,8,0,0,1,0,16H56A8,8,0,0,1,48,64ZM64,32a8,8,0,0,1,8-8H184a8,8,0,0,1,0,16H72A8,8,0,0,1,64,32Z"></path></svg> -->
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
					fill="currentColor"
					viewBox="0 0 256 256"
					><path
						d="M240,192h-8V98.67a16,16,0,0,0-7.12-13.31l-88-58.67a16,16,0,0,0-17.75,0l-88,58.67A16,16,0,0,0,24,98.67V192H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM40,98.67,128,40l88,58.66V192H192V136a8,8,0,0,0-8-8H72a8,8,0,0,0-8,8v56H40ZM176,144v16H136V144Zm-56,16H80V144h40ZM80,176h40v16H80Zm56,0h40v16H136Z"
					></path></svg
				>
				<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No equipment found</h3>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					Get started by adding some equipment to your inventory.
				</p>
				<div class="mt-6">
					<a
						href="/"
						class="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
					>
						Add your first equipment
					</a>
				</div>
			</div>
		{:else}
			<ul class="m-0 flex list-none flex-col gap-4 p-0">
				{#each equipment as equipmentItem (equipmentItem.id)}
					<EquipmentListItem
						equipment={equipmentItem}
						{equipmentTypes}
						onEdit={openEditModal}
						onDelete={openDeleteModal}
					/>
				{/each}
			</ul>
		{/if}
</main>

<EditEquipmentModal
	isOpen={showEditModal}
	equipment={selectedEquipment}
	{equipmentTypes}
	equipmentUpdated={handleEquipmentUpdated}
	onCloseModal={() => {
		showEditModal = false;
		selectedEquipment = null;
	}}
/>

<DeleteConfirmationModal
	isOpen={showDeleteModal}
	title="Delete Equipment"
	message="Are you sure you want to delete this equipment? This action cannot be undone and will also delete all associated maintenance tasks."
	onConfirm={handleDeleteConfirm}
	onCancel={() => {
		showDeleteModal = false;
		selectedEquipment = null;
	}}
/>
