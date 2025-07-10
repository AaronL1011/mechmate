<script lang="ts">
	import type { CompleteTaskRequest, Task, Equipment, MaintenanceLog } from '$lib/types/db.js';

	let {
		taskCompleted,
		isOpen,
		task,
		equipment,
		onCloseModal
	}: {
		taskCompleted: (result: {
			updated_task: Task;
			maintenance_log: MaintenanceLog;
			message: string;
		}) => void;
		isOpen: boolean;
		task: Task | null;
		equipment: Equipment[];
		onCloseModal: () => void;
	} = $props();

	let formData: CompleteTaskRequest = $state({
		task_id: 0,
		completed_date: new Date().toISOString().split('T')[0],
		completed_usage_value: 0,
		notes: '',
		cost: undefined,
		parts_used: [],
		service_provider: ''
	});

	let loading = $state(false);
	let error = $state('');
	let newPart = $state('');

	$effect(() => {
		if (task) {
			formData.task_id = task.id;
			const currentEquipment = equipment.find((e) => e.id === task.equipment_id);
			if (currentEquipment) {
				formData.completed_usage_value = currentEquipment.current_usage_value;
			}
		}
	});

	function getEquipmentName(equipmentId: number): string {
		return equipment.find((e) => e.id === equipmentId)?.name || 'Unknown Equipment';
	}

	function getEquipmentUsageUnit(equipmentId: number): string {
		return equipment.find((e) => e.id === equipmentId)?.usage_unit || 'units';
	}

	function addPart() {
		if (newPart.trim()) {
			formData.parts_used = [...(formData.parts_used || []), newPart.trim()];
			newPart = '';
		}
	}

	function removePart(index: number) {
		formData.parts_used = formData.parts_used?.filter((_, i) => i !== index) || [];
	}

	async function handleSubmit() {
		if (!formData.completed_date) {
			error = 'Completion date is required';
			return;
		}

		try {
			loading = true;
			error = '';

			const response = await fetch('/api/tasks/complete', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(formData)
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to complete task');
			}

			const result = await response.json();
			taskCompleted(result);
			closeModal();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to complete task';
		} finally {
			loading = false;
		}
	}

	function closeModal() {
		isOpen = false;
		// Reset form
		formData = {
			task_id: 0,
			completed_date: new Date().toISOString().split('T')[0],
			completed_usage_value: 0,
			notes: '',
			cost: undefined,
			parts_used: [],
			service_provider: ''
		};
		error = '';
		newPart = '';
		onCloseModal();
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeModal();
		}
	}
</script>

{#if isOpen && task}
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
					<h3 class="text-lg font-medium text-gray-900 dark:text-white">Complete Task</h3>
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

				<!-- Task Info -->
				<div class="mb-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
					<h4 class="font-medium text-gray-900 dark:text-white">{task.title}</h4>
					<p class="text-sm text-gray-600 dark:text-gray-300">
						{getEquipmentName(task.equipment_id)}
					</p>
					{#if task.description}
						<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{task.description}</p>
					{/if}
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
							for="completed_date"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Completion Date *</label
						>
						<input
							type="date"
							id="completed_date"
							bind:value={formData.completed_date}
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
							required
						/>
					</div>

					<div>
						<label
							for="completed_usage_value"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Usage at Completion</label
						>
						<div class="mt-1 flex rounded-md shadow-sm">
							<input
								type="number"
								id="completed_usage_value"
								bind:value={formData.completed_usage_value}
								class="flex-1 rounded-l-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
								placeholder="0"
								min="0"
								step="0.1"
							/>
							<span
								class="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-400"
							>
								{getEquipmentUsageUnit(task.equipment_id)}
							</span>
						</div>
					</div>

					<div>
						<label for="notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Notes</label
						>
						<textarea
							id="notes"
							bind:value={formData.notes}
							rows="3"
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
							placeholder="Any notes about the maintenance performed..."
						></textarea>
					</div>

					<div>
						<label for="cost" class="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Cost</label
						>
						<div class="mt-1 flex rounded-md shadow-sm">
							<span
								class="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-400"
							>
								$
							</span>
							<input
								type="number"
								id="cost"
								bind:value={formData.cost}
								class="flex-1 rounded-r-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
								placeholder="0.00"
								min="0"
								step="0.01"
							/>
						</div>
					</div>

					<div>
						<label
							for="service_provider"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Service Provider</label
						>
						<input
							type="text"
							id="service_provider"
							bind:value={formData.service_provider}
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
							placeholder="e.g., DIY, Local Garage, Dealer"
						/>
					</div>

					<div>
						<label
							for="parts_used"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300">Parts Used</label
						>
						<div class="mt-1 space-y-2">
							{#if formData.parts_used && formData.parts_used.length > 0}
								<div class="space-y-1">
									{#each formData.parts_used as part, index (part)}
										<div class="flex items-center space-x-2">
											<span
												class="flex-1 rounded bg-gray-100 px-2 py-1 text-sm dark:bg-gray-600 dark:text-white"
												>{part}</span
											>
											<button
												type="button"
												aria-label="Remove part"
												onclick={() => removePart(index)}
												class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
											>
												<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M6 18L18 6M6 6l12 12"
													></path>
												</svg>
											</button>
										</div>
									{/each}
								</div>
							{/if}
							<div class="flex space-x-2">
								<input
									type="text"
									bind:value={newPart}
									onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addPart())}
									class="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
									placeholder="Add a part..."
								/>
								<button
									type="button"
									onclick={addPart}
									class="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-blue-700 dark:hover:bg-blue-600"
								>
									Add
								</button>
							</div>
						</div>
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
							{loading ? 'Completing...' : 'Complete Task'}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}
