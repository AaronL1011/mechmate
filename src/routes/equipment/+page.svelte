<script lang="ts">
	import { onMount } from 'svelte';
	import type { Equipment, EquipmentType } from '$lib/types/db.js';
	import EditEquipmentModal from '$lib/components/EditEquipmentModal.svelte';
	import DeleteConfirmationModal from '$lib/components/DeleteConfirmationModal.svelte';

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

	onMount(() => {
		loadEquipment();
	});
</script>

<svelte:head>
	<title>Equipment Management - Mechmate</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8 dark:bg-gray-900">
	<!-- Header -->
	<header class="mx-auto mb-8 max-w-7xl">
		<div class="mb-4 flex items-center gap-4">
			<a
				href="/"
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
					Equipment Management
				</h1>
				<p class="text-gray-600 dark:text-gray-300">Track inventory and export service history</p>
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
			<div
				class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800 dark:shadow-gray-900/20"
			>
				<ul class="divide-y divide-gray-200 dark:divide-gray-700">
					{#each equipment as equipmentItem (equipmentItem.id)}
						<li class="px-6 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700">
							<div class="flex flex-wrap items-center justify-between gap-y-4">
								<div class="flex min-w-[400px] flex-1 items-center">
									<div class="ml-4 flex-1">
										<div class="flex items-center justify-between">
											<div>
												<h3 class="text-lg font-medium text-gray-900 dark:text-white">
													{equipmentItem.name}
												</h3>
												<div
													class="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300"
												>
													<span class="capitalize"
														>{getEquipmentTypeName(equipmentItem.equipment_type_id)}</span
													>
													{#if equipmentItem.make || equipmentItem.model}
														<span>•</span>
														<span>{equipmentItem.make} {equipmentItem.model}</span>
													{/if}
													{#if equipmentItem.year}
														<span>•</span>
														<span>{equipmentItem.year}</span>
													{/if}
												</div>
												<div
													class="mt-1 flex items-center space-x-4 text-xs text-gray-500 lg:text-sm dark:text-gray-400"
												>
													<span
														>Current usage: {equipmentItem.current_usage_value}
														{equipmentItem.usage_unit}</span
													>
													{#if equipmentItem.purchase_date}
														<span>•</span>
														<span>Purchased: {formatDate(equipmentItem.purchase_date)}</span>
													{/if}
												</div>
												{#if equipmentItem.serial_number}
													<p class="mt-1 text-xs text-gray-500 lg:text-sm dark:text-gray-400">
														Serial: {equipmentItem.serial_number}
													</p>
												{/if}
												{#if equipmentItem.tags}
													{@const tags = parseTags(equipmentItem.tags)}
													{#if tags.length > 0}
														<div class="mt-2 flex flex-wrap gap-1">
															{#each tags as tag (tag)}
																<span
																	class="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200"
																>
																	{tag}
																</span>
															{/each}
														</div>
													{/if}
												{/if}
											</div>
										</div>
									</div>
								</div>
								<div class="ml-auto flex items-center space-x-2">
									<a
										href="/equipment/{equipmentItem.id}/history"
										class="rounded bg-green-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
									>
										View History
									</a>
									<button
										class="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
										on:click={() => openEditModal(equipmentItem)}
									>
										Edit
									</button>
									<button
										class="rounded bg-red-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
										on:click={() => openDeleteModal(equipmentItem)}
									>
										Delete
									</button>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</main>
</div>

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
