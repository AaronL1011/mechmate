<script lang="ts">
	import type { Equipment, EquipmentType, UpdateEquipmentRequest } from '$lib/types/db.js';
	import AutocompleteSelect from './AutocompleteSelect.svelte';
	import ModalShell from './ModalShell.svelte';
	import {
		btnCancelClass,
		btnPrimaryClass,
		detailsSummaryClass,
		errorAlertClass,
		errorTextClass,
		footerButtonRowClass,
		inputClass,
		labelClass,
		responsiveTwoColGridClass
	} from './modalFormStyles.js';

	const FORM_ID = 'edit-equipment-form';

	let {
		equipmentUpdated,
		isOpen,
		equipment,
		equipmentTypes,
		onCloseModal
	}: {
		equipmentUpdated: (equipment: Equipment) => void;
		isOpen: boolean;
		equipment: Equipment | null;
		equipmentTypes: EquipmentType[];
		onCloseModal: () => void;
	} = $props();

	let formData: UpdateEquipmentRequest = $state({
		name: '',
		equipment_type_id: 0,
		make: '',
		model: '',
		year: undefined,
		serial_number: '',
		purchase_date: '',
		location: '',
		current_usage_value: 0,
		usage_unit: '',
		metadata: {},
		tags: []
	});

	let typesLocal = $state<EquipmentType[]>([]);
	let loading = $state(false);
	let error = $state('');

	function parseMetadata(metadata: string | null): Record<string, any> {
		if (!metadata) return {};
		try {
			return JSON.parse(metadata);
		} catch {
			return {};
		}
	}

	function parseTags(tags: string | null): string[] {
		if (!tags) return [];
		try {
			return JSON.parse(tags);
		} catch {
			return [];
		}
	}

	$effect(() => {
		if (isOpen) {
			typesLocal = [...equipmentTypes];
		}
	});

	$effect(() => {
		if (equipment && isOpen) {
			formData = {
				name: equipment.name,
				equipment_type_id: equipment.equipment_type_id,
				make: equipment.make || '',
				model: equipment.model || '',
				year: equipment.year,
				serial_number: equipment.serial_number || '',
				purchase_date: equipment.purchase_date || '',
				location: (equipment as { location?: string | null }).location ?? '',
				current_usage_value: equipment.current_usage_value,
				usage_unit: equipment.usage_unit,
				metadata: parseMetadata(equipment.metadata || null),
				tags: parseTags(equipment.tags || null)
			};
		}
	});

	async function handleSubmit() {
		if (
			!formData.name ||
			formData.equipment_type_id === undefined ||
			!formData.usage_unit ||
			!equipment
		) {
			error = 'Name, type, and usage unit are required';
			return;
		}

		try {
			loading = true;
			error = '';

			const response = await fetch(`/api/equipment/${equipment.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(formData)
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to update equipment');
			}

			const updatedEquipment = (await response.json()) as Equipment;
			equipmentUpdated(updatedEquipment);
			closeModal();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update equipment';
		} finally {
			loading = false;
		}
	}

	async function handleEquipmentTypeCreate(name: string) {
		try {
			error = '';

			const equipmentTypeRes = await fetch('/api/equipment-types', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ name })
			});

			if (!equipmentTypeRes.ok) {
				const errorData = await equipmentTypeRes.json();
				throw new Error(errorData.error || 'Failed to create equipment type');
			}

			const equipmentTypeData = (await equipmentTypeRes.json()) as { id: number; name: string };
			formData.equipment_type_id = equipmentTypeData.id;

			if (!typesLocal.find((et) => et.id === equipmentTypeData.id)) {
				typesLocal = [equipmentTypeData, ...typesLocal];
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create equipment type';
		}
	}

	function closeModal() {
		formData = {
			name: '',
			equipment_type_id: 0,
			make: '',
			model: '',
			year: undefined,
			serial_number: '',
			purchase_date: '',
			location: '',
			current_usage_value: 0,
			usage_unit: '',
			metadata: {},
			tags: []
		};
		error = '';
		onCloseModal();
	}

	function onFormSubmit(e: SubmitEvent) {
		e.preventDefault();
		handleSubmit();
	}

	const shellOpen = $derived(isOpen && equipment != null);
</script>

<ModalShell open={shellOpen} onClose={closeModal} titleId="edit-equipment-modal-title" size="lg">
	{#snippet title()}Edit Equipment{/snippet}

	{#snippet children()}
		{#if equipment}
			<form id={FORM_ID} class="space-y-4" onsubmit={onFormSubmit}>
				{#if error}
					<div class={errorAlertClass}>
						<p class={errorTextClass}>{error}</p>
					</div>
				{/if}

				<div>
					<label for="edit-eq-name" class={labelClass}>Name *</label>
					<input
						type="text"
						id="edit-eq-name"
						bind:value={formData.name}
						class={inputClass}
						placeholder="e.g., My Car, Coffee Machine"
						required
					/>
				</div>

				<AutocompleteSelect
					options={typesLocal}
					bind:value={formData.equipment_type_id}
					onCreate={handleEquipmentTypeCreate}
				/>

				<div class={responsiveTwoColGridClass}>
					<div>
						<label for="edit-eq-current-usage" class={labelClass}>Current Usage</label>
						<input
							type="number"
							id="edit-eq-current-usage"
							bind:value={formData.current_usage_value}
							class={inputClass}
							placeholder="0"
							min="0"
							step="0.1"
						/>
					</div>

					<div>
						<label for="edit-eq-usage-unit" class={labelClass}>Unit *</label>
						<input
							type="text"
							id="edit-eq-usage-unit"
							bind:value={formData.usage_unit}
							class={inputClass}
							placeholder="e.g., km, hours"
							required
						/>
					</div>
				</div>

				<details
					class="rounded-lg border border-gray-200 dark:border-gray-600 [&[open]_summary_svg]:rotate-90"
				>
					<summary class="{detailsSummaryClass} px-3 py-2.5">
						<svg
							class="h-4 w-4 shrink-0 rotate-0 text-gray-500 transition-transform dark:text-gray-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							></path>
						</svg>
						Additional details
						<span class="font-normal text-gray-500 dark:text-gray-400"
							>(make, model, IDs, location…)</span
						>
					</summary>
					<div class="space-y-4 border-t border-gray-100 px-3 py-4 dark:border-gray-700">
						<div class={responsiveTwoColGridClass}>
							<div>
								<label for="edit-eq-make" class={labelClass}>Make</label>
								<input
									type="text"
									id="edit-eq-make"
									bind:value={formData.make}
									class={inputClass}
									placeholder="e.g., Toyota, Breville"
								/>
							</div>

							<div>
								<label for="edit-eq-model" class={labelClass}>Model</label>
								<input
									type="text"
									id="edit-eq-model"
									bind:value={formData.model}
									class={inputClass}
									placeholder="e.g., Camry, BES870XL"
								/>
							</div>
						</div>

						<div class={responsiveTwoColGridClass}>
							<div>
								<label for="edit-eq-year" class={labelClass}>Year</label>
								<input
									type="number"
									id="edit-eq-year"
									bind:value={formData.year}
									class={inputClass}
									placeholder="e.g., 2020"
									min="1900"
									max={new Date().getFullYear() + 1}
								/>
							</div>

							<div>
								<label for="edit-eq-serial" class={labelClass}>Serial Number</label>
								<input
									type="text"
									id="edit-eq-serial"
									bind:value={formData.serial_number}
									class={inputClass}
									placeholder="Optional"
								/>
							</div>
						</div>

						<div>
							<label for="edit-eq-purchase" class={labelClass}>Purchase Date</label>
							<input
								type="date"
								id="edit-eq-purchase"
								bind:value={formData.purchase_date}
								class={inputClass}
							/>
						</div>

						<div>
							<label for="edit-eq-location" class={labelClass}>Location</label>
							<input
								type="text"
								id="edit-eq-location"
								bind:value={formData.location}
								class={inputClass}
								placeholder="e.g. Garage, Shed"
							/>
						</div>
					</div>
				</details>
			</form>
		{/if}
	{/snippet}

	{#snippet footer()}
		<div class={footerButtonRowClass}>
			<button type="button" class={btnCancelClass} onclick={closeModal}>Cancel</button>
			<button
				type="submit"
				form={FORM_ID}
				class={btnPrimaryClass}
				disabled={loading || !equipment}
			>
				{loading ? 'Updating...' : 'Update Equipment'}
			</button>
		</div>
	{/snippet}
</ModalShell>
