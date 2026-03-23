<script lang="ts">
	import type { CreateEquipmentRequest, Equipment, EquipmentType } from '$lib/types/db.js';
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

	const FORM_ID = 'add-equipment-form';

	let {
		equipmentCreated,
		isOpen,
		equipmentTypes,
		onCloseModal
	}: {
		equipmentCreated: (equipment: Equipment) => void;
		isOpen: boolean;
		equipmentTypes: EquipmentType[];
		onCloseModal: () => void;
	} = $props();

	interface CreateEquipmentFormData extends Omit<CreateEquipmentRequest, 'equipment_type_id'> {
		equipment_type_id: number | undefined;
	}

	let formData: CreateEquipmentFormData = $state({
		name: '',
		equipment_type_id: undefined,
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

	$effect(() => {
		if (isOpen) {
			typesLocal = [...equipmentTypes];
		}
	});

	async function handleSubmit() {
		if (!formData.name || formData.equipment_type_id === undefined || !formData.usage_unit) {
			error = 'Name, type, and usage unit are required';
			return;
		}

		try {
			loading = true;
			error = '';

			const response = await fetch('/api/equipment', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(formData)
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to create equipment');
			}

			const equipment = (await response.json()) as Equipment;
			equipmentCreated(equipment);
			closeModal();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create equipment';
		} finally {
			loading = false;
		}
	}

	function closeModal() {
		formData = {
			name: '',
			equipment_type_id: undefined,
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

	function onFormSubmit(e: SubmitEvent) {
		e.preventDefault();
		handleSubmit();
	}
</script>

<ModalShell open={isOpen} onClose={closeModal} titleId="add-equipment-modal-title" size="lg">
	{#snippet title()}Add New Equipment{/snippet}

	{#snippet children()}
		<form id={FORM_ID} class="space-y-4" onsubmit={onFormSubmit}>
			{#if error}
				<div class={errorAlertClass}>
					<p class={errorTextClass}>{error}</p>
				</div>
			{/if}

			<div>
				<label for="add-eq-name" class={labelClass}>Name *</label>
				<input
					type="text"
					id="add-eq-name"
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
					<label for="add-eq-current-usage" class={labelClass}>Current Usage</label>
					<input
						type="number"
						id="add-eq-current-usage"
						bind:value={formData.current_usage_value}
						class={inputClass}
						placeholder="0"
						min="0"
						step="0.1"
					/>
				</div>

				<div>
					<label for="add-eq-usage-unit" class={labelClass}>Usage Unit *</label>
					<input
						type="text"
						id="add-eq-usage-unit"
						bind:value={formData.usage_unit}
						class={inputClass}
						placeholder="e.g. km, hours"
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
							<label for="add-eq-make" class={labelClass}>Make</label>
							<input
								type="text"
								id="add-eq-make"
								bind:value={formData.make}
								class={inputClass}
								placeholder="e.g. Toyota, Breville"
							/>
						</div>

						<div>
							<label for="add-eq-model" class={labelClass}>Model</label>
							<input
								type="text"
								id="add-eq-model"
								bind:value={formData.model}
								class={inputClass}
								placeholder="e.g. Camry, BES870XL"
							/>
						</div>
					</div>

					<div class={responsiveTwoColGridClass}>
						<div>
							<label for="add-eq-year" class={labelClass}>Year</label>
							<input
								type="number"
								id="add-eq-year"
								bind:value={formData.year}
								class={inputClass}
								placeholder="e.g. 2020"
								min="1900"
								max={new Date().getFullYear() + 1}
							/>
						</div>

						<div>
							<label for="add-eq-serial" class={labelClass}
								>Identifier (e.g. rego, serial)</label
							>
							<input
								type="text"
								id="add-eq-serial"
								bind:value={formData.serial_number}
								class={inputClass}
								placeholder="Optional"
							/>
						</div>
					</div>

					<div>
						<label for="add-eq-purchase" class={labelClass}>Purchase Date</label>
						<input
							type="date"
							id="add-eq-purchase"
							bind:value={formData.purchase_date}
							class={inputClass}
						/>
					</div>

					<div>
						<label for="add-eq-location" class={labelClass}>Location</label>
						<input
							type="text"
							id="add-eq-location"
							bind:value={formData.location}
							class={inputClass}
							placeholder="e.g. Garage, Shed"
						/>
					</div>
				</div>
			</details>
		</form>
	{/snippet}

	{#snippet footer()}
		<div class={footerButtonRowClass}>
			<button type="button" class={btnCancelClass} onclick={closeModal}>Cancel</button>
			<button
				type="submit"
				form={FORM_ID}
				class={btnPrimaryClass}
				disabled={loading}
			>
				{loading ? 'Adding...' : 'Add Equipment'}
			</button>
		</div>
	{/snippet}
</ModalShell>
