<script lang="ts">
	import type { CreateTaskRequest, Equipment, EquipmentType, Task, TaskType } from '$lib/types/db.js';
	import ModalShell from './ModalShell.svelte';
	import {
		affixAddonRightClass,
		affixInputLeftClass,
		affixRowClass,
		btnCancelClass,
		btnPrimaryClass,
		detailsSummaryClass,
		errorAlertClass,
		errorTextClass,
		footerButtonRowClass,
		inputClass,
		labelClass,
		selectClass,
		textareaClass
	} from './modalFormStyles.js';

	const FORM_ID = 'add-task-form';

	let {
		taskCreated,
		isOpen,
		equipment,
		taskTypes,
		equipmentTypes,
		onCloseModal
	}: {
		taskCreated: (task: Task) => void;
		isOpen: boolean;
		equipment: Equipment[];
		taskTypes: TaskType[];
		equipmentTypes: EquipmentType[];
		onCloseModal: () => void;
	} = $props();

	let formData: CreateTaskRequest = $state({
		equipment_id: 0,
		task_type_id: 0,
		title: '',
		description: '',
		usage_interval: undefined,
		time_interval_days: undefined,
		priority: 'medium'
	});

	let loading = $state(false);
	let error = $state('');

	async function handleSubmit() {
		if (!formData.equipment_id || !formData.task_type_id || !formData.title) {
			error = 'Equipment, task type, and title are required';
			return;
		}

		if (!formData.usage_interval && !formData.time_interval_days) {
			error = 'Please specify either a usage interval or time interval';
			return;
		}

		try {
			loading = true;
			error = '';

			const response = await fetch('/api/tasks', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(formData)
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to create task');
			}

			const task = (await response.json()) as Task;
			taskCreated(task);
			closeModal();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create task';
		} finally {
			loading = false;
		}
	}

	function closeModal() {
		formData = {
			equipment_id: 0,
			task_type_id: 0,
			title: '',
			description: '',
			usage_interval: undefined,
			time_interval_days: undefined,
			priority: 'medium'
		};
		error = '';
		onCloseModal();
	}

	function getEquipmentTypeName(equipmentTypeId: number) {
		return equipmentTypes.find((e) => e.id === equipmentTypeId)?.name || 'Unknown';
	}

	function onFormSubmit(e: SubmitEvent) {
		e.preventDefault();
		handleSubmit();
	}
</script>

<ModalShell open={isOpen} onClose={closeModal} titleId="add-task-modal-title" size="lg">
	{#snippet title()}Add New Task{/snippet}

	{#snippet children()}
		<form id={FORM_ID} class="space-y-4" onsubmit={onFormSubmit}>
			{#if error}
				<div class={errorAlertClass}>
					<p class={errorTextClass}>{error}</p>
				</div>
			{/if}

			<div>
				<label for="add-task-equipment" class={labelClass}>Equipment *</label>
				<select
					id="add-task-equipment"
					bind:value={formData.equipment_id}
					class={selectClass}
					required
				>
					<option value={0}>Select equipment</option>
					{#each equipment as eq (eq.id)}
						<option value={eq.id}
							>{eq.name} ({getEquipmentTypeName(eq.equipment_type_id)})</option
						>
					{/each}
				</select>
			</div>

			<div>
				<label for="add-task-type" class={labelClass}>Task Type *</label>
				<select id="add-task-type" bind:value={formData.task_type_id} class={selectClass} required>
					<option value={0}>Select task type</option>
					{#each taskTypes as tt (tt.id)}
						<option value={tt.id}>{tt.name}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="add-task-title" class={labelClass}>Title *</label>
				<input
					type="text"
					id="add-task-title"
					bind:value={formData.title}
					class={inputClass}
					placeholder="e.g., Oil Change, Filter Replacement"
					required
				/>
			</div>

			<div>
				<label for="add-task-description" class={labelClass}>Description</label>
				<textarea
					id="add-task-description"
					bind:value={formData.description}
					rows="3"
					class={textareaClass}
					placeholder="Optional description of the task"
				></textarea>
			</div>

			<div>
				<label for="add-task-priority" class={labelClass}>Priority</label>
				<select id="add-task-priority" bind:value={formData.priority} class={selectClass}>
					<option value="low">Low</option>
					<option value="medium">Medium</option>
					<option value="high">High</option>
					<option value="critical">Critical</option>
				</select>
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
					Scheduling options
					<span class="font-normal text-gray-500 dark:text-gray-400"
						>(usage or time interval — one required)</span
					>
				</summary>
				<div class="space-y-4 border-t border-gray-100 px-3 py-4 dark:border-gray-700">
					<div>
						<label for="add-task-usage-interval" class={labelClass}>Usage interval</label>
						<div class={affixRowClass}>
							<input
								type="number"
								id="add-task-usage-interval"
								bind:value={formData.usage_interval}
								class={affixInputLeftClass}
								placeholder="e.g., 5000"
								min="0"
								step="0.1"
							/>
							<span class={affixAddonRightClass}>
								{#if formData.equipment_id}
									{@const selectedEquipment = equipment.find(
										(e) => e.id === formData.equipment_id
									)}
									{selectedEquipment?.usage_unit || 'units'}
								{:else}
									units
								{/if}
							</span>
						</div>
						<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							Leave empty if using time-based scheduling
						</p>
					</div>

					<div>
						<label for="add-task-time-interval" class={labelClass}>Time interval</label>
						<div class={affixRowClass}>
							<input
								type="number"
								id="add-task-time-interval"
								bind:value={formData.time_interval_days}
								class={affixInputLeftClass}
								placeholder="e.g., 90"
								min="0"
							/>
							<span class={affixAddonRightClass}>days</span>
						</div>
						<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							Leave empty if using usage-based scheduling
						</p>
					</div>
				</div>
			</details>
		</form>
	{/snippet}

	{#snippet footer()}
		<div class={footerButtonRowClass}>
			<button type="button" class={btnCancelClass} onclick={closeModal}>Cancel</button>
			<button type="submit" form={FORM_ID} class={btnPrimaryClass} disabled={loading}>
				{loading ? 'Adding...' : 'Add Task'}
			</button>
		</div>
	{/snippet}
</ModalShell>
