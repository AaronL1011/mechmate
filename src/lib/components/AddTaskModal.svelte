<script lang="ts">
	import type { CreateTaskRequest, Equipment, EquipmentType, TaskType } from '$lib/types/db.js';

	let {
		taskCreated,
		isOpen,
		equipment,
		taskTypes,
		equipmentTypes,
		onCloseModal
	}: {
		taskCreated: (task: CustomEvent) => void;
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
	let showAdvanced = $state(false);

	const priorities = [
		{
			value: 'low',
			label: 'Low',
			color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
		},
		{
			value: 'medium',
			label: 'Medium',
			color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
		},
		{
			value: 'high',
			label: 'High',
			color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200'
		},
		{
			value: 'critical',
			label: 'Critical',
			color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
		}
	];

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

			const task = await response.json();
			taskCreated(task);
			closeModal();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create task';
		} finally {
			loading = false;
		}
	}

	function closeModal() {
		isOpen = false;
		// Reset form
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
		showAdvanced = false;
		onCloseModal();
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeModal();
		}
	}

	function getEquipmentTypeName(equipmentTypeId: number) {
		return equipmentTypes.find((e) => e.id === equipmentTypeId)?.name || 'Unknown';
	}
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex h-dvh w-full items-center justify-center overflow-y-auto bg-gray-600/50 backdrop-blur-sm dark:bg-gray-900/50"
		onclick={handleBackdropClick}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onkeydown={(e) => e.key === 'Escape' && closeModal()}
	>
		<div
			class="relative h-fit max-h-[90vh] max-w-xl overflow-y-auto rounded-md border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:shadow-gray-900/50"
		>
			<div class="mt-3">
				<div class="mb-4 flex items-center justify-between">
					<h3 class="text-lg font-medium text-gray-900 dark:text-white">Add New Task</h3>
					<button
						type="button"
						class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
						onclick={closeModal}
						aria-label="Close"
					>
						<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							></path>
						</svg>
					</button>
				</div>

				<form onsubmit={handleSubmit} class="space-y-4">
					{#if error}
						<div
							class="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20"
						>
							<p class="text-sm text-red-800 dark:text-red-200">{error}</p>
						</div>
					{/if}

					<div>
						<label
							for="equipment"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300">Equipment *</label
						>
						<select
							id="equipment"
							bind:value={formData.equipment_id}
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
						<label
							for="task_type"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300">Task Type *</label
						>
						<select
							id="task_type"
							bind:value={formData.task_type_id}
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
							required
						>
							<option value={0}>Select task type</option>
							{#each taskTypes as type (type.id)}
								<option value={type.id}>{type.name}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="title" class="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Title *</label
						>
						<input
							type="text"
							id="title"
							bind:value={formData.title}
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
							placeholder="e.g., Oil Change, Filter Replacement"
							required
						/>
					</div>

					<div>
						<label
							for="description"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label
						>
						<textarea
							id="description"
							bind:value={formData.description}
							rows="3"
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
							placeholder="Optional description of the task"
						></textarea>
					</div>

					<div>
						<label for="priority" class="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Priority</label
						>
						<select
							id="priority"
							bind:value={formData.priority}
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
						>
							{#each priorities as priority (priority.value)}
								<option value={priority.value}>{priority.label}</option>
							{/each}
						</select>
					</div>

					<div class="border-t border-gray-200 pt-4 dark:border-gray-700">
						<button
							type="button"
							onclick={() => (showAdvanced = !showAdvanced)}
							class="flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
						>
							<svg
								class="mr-2 h-4 w-4 {showAdvanced ? 'rotate-90' : ''}"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 5l7 7-7 7"
								></path>
							</svg>
							Scheduling Options
						</button>

						{#if showAdvanced}
							<div class="mt-4 space-y-4">
								<div>
									<label
										for="usage_interval"
										class="block text-sm font-medium text-gray-700 dark:text-gray-300"
										>Usage Interval</label
									>
									<div class="mt-1 flex rounded-md shadow-sm">
										<input
											type="number"
											id="usage_interval"
											bind:value={formData.usage_interval}
											class="flex-1 rounded-l-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
											placeholder="e.g., 5000"
											min="0"
											step="0.1"
										/>
										<span
											class="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-400"
										>
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
									<label
										for="time_interval_days"
										class="block text-sm font-medium text-gray-700 dark:text-gray-300"
										>Time Interval</label
									>
									<div class="mt-1 flex rounded-md shadow-sm">
										<input
											type="number"
											id="time_interval_days"
											bind:value={formData.time_interval_days}
											class="flex-1 rounded-l-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
											placeholder="e.g., 90"
											min="0"
										/>
										<span
											class="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-400"
										>
											days
										</span>
									</div>
									<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
										Leave empty if using usage-based scheduling
									</p>
								</div>
							</div>
						{/if}
					</div>

					<div class="flex justify-end space-x-3 pt-4">
						<button
							type="button"
							onclick={closeModal}
							class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={loading}
							class="rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-700 dark:hover:bg-green-600"
						>
							{loading ? 'Adding...' : 'Add Task'}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}
