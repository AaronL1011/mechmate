<script lang="ts">
	import type { CompleteTaskRequest, Task, Equipment, MaintenanceLog } from '$lib/types/db.js';
	import ModalShell from './ModalShell.svelte';
	import {
		affixAddonLeftClass,
		affixAddonRightClass,
		affixInputLeftClass,
		affixInputRightClass,
		affixRowClass,
		btnCancelClass,
		btnPrimaryClass,
		detailsSummaryClass,
		errorAlertClass,
		errorTextClass,
		footerButtonRowClass,
		inputClass,
		inputFieldClass,
		labelClass,
		textareaClass
	} from './modalFormStyles.js';

	const FORM_ID = 'complete-task-form';
	const ATTACHMENT_FILE_INPUT_ID = 'complete-task-attachment-file';

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
	let completedLogId = $state<number | null>(null);
	let attachmentFile = $state<File | null>(null);
	let attachmentUploading = $state(false);
	let attachmentError = $state('');

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
			completedLogId = result.maintenance_log?.id ?? null;
			taskCompleted(result);
			if (!completedLogId) closeModal();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to complete task';
		} finally {
			loading = false;
		}
	}

	function closeModal() {
		completedLogId = null;
		attachmentFile = null;
		attachmentError = '';
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

	async function uploadAttachment() {
		if (!completedLogId || !attachmentFile) return;
		attachmentUploading = true;
		attachmentError = '';
		try {
			const uploadBody = new FormData();
			uploadBody.set('file', attachmentFile);
			const res = await fetch(`/api/maintenance-logs/${completedLogId}/attachments`, {
				method: 'POST',
				body: uploadBody
			});
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Upload failed');
			}
			attachmentFile = null;
		} catch (err) {
			attachmentError = err instanceof Error ? err.message : 'Upload failed';
		} finally {
			attachmentUploading = false;
		}
	}

	function onFormSubmit(e: SubmitEvent) {
		e.preventDefault();
		handleSubmit();
	}

	const shellOpen = $derived(isOpen && task != null);
</script>

<ModalShell open={shellOpen} onClose={closeModal} titleId="complete-task-modal-title" size="lg">
	{#snippet title()}
		{#if completedLogId}
			Add attachment (optional)
		{:else}
			Complete task
		{/if}
	{/snippet}

	{#snippet children()}
		{#if task}
			{#if completedLogId}
				<div class="space-y-4">
					<p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
						Step 2 of 2
					</p>
					<p class="text-sm font-medium text-green-700 dark:text-green-400">Task completed.</p>
					<p class="text-sm text-gray-600 dark:text-gray-400">
						Add a receipt, photo, or PDF to this maintenance log (optional).
					</p>
					{#if attachmentError}
						<p class="text-sm text-red-600 dark:text-red-400">{attachmentError}</p>
					{/if}
					<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
						<div
							class="inline-flex max-w-full flex-row flex-wrap items-center gap-x-3 gap-y-1"
						>
							<label
								for={ATTACHMENT_FILE_INPUT_ID}
								class="w-fit shrink-0 cursor-pointer rounded-md border border-blue-200/90 bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-800 transition-[background-color,border-color] duration-150 hover:border-blue-300 hover:bg-blue-100 dark:border-blue-800/70 dark:bg-blue-900/35 dark:text-blue-100 dark:hover:border-blue-600 dark:hover:bg-blue-900/55"
							>
								Browse…
							</label>
							<input
								id={ATTACHMENT_FILE_INPUT_ID}
								type="file"
								accept="image/*,.pdf"
								class="sr-only"
								onchange={(e) => {
									attachmentFile = e.currentTarget.files?.[0] ?? null;
								}}
							/>
							{#if attachmentFile}
								<span
									class="min-w-0 max-w-[min(100%,18rem)] truncate text-sm text-gray-700 sm:max-w-xs dark:text-gray-300"
									title={attachmentFile.name}
								>
									{attachmentFile.name}
								</span>
							{:else}
								<span class="shrink-0 text-sm text-gray-500 dark:text-gray-500">No file chosen</span>
							{/if}
						</div>
						<button
							type="button"
							disabled={!attachmentFile || attachmentUploading}
							onclick={uploadAttachment}
							class="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
						>
							{attachmentUploading ? 'Uploading...' : 'Upload'}
						</button>
					</div>
				</div>
			{:else}
				<div class="mb-4 rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/80">
					<p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
						Step 1 of 2
					</p>
					<h4 class="mt-1 font-medium text-gray-900 dark:text-white">{task.title}</h4>
					<p class="text-sm text-gray-600 dark:text-gray-300">
						{getEquipmentName(task.equipment_id)}
					</p>
					{#if task.description}
						<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{task.description}</p>
					{/if}
				</div>

				<form id={FORM_ID} class="space-y-4" onsubmit={onFormSubmit}>
					{#if error}
						<div class={errorAlertClass}>
							<p class={errorTextClass}>{error}</p>
						</div>
					{/if}

					<div>
						<label for="complete-task-date" class={labelClass}>Completion date *</label>
						<input
							type="date"
							id="complete-task-date"
							bind:value={formData.completed_date}
							class={inputClass}
							required
						/>
					</div>

					<div>
						<label for="complete-task-usage" class={labelClass}>Usage at completion</label>
						<div class={affixRowClass}>
							<input
								type="number"
								id="complete-task-usage"
								bind:value={formData.completed_usage_value}
								class={affixInputLeftClass}
								placeholder="0"
								min="0"
								step="0.1"
							/>
							<span class={affixAddonRightClass}>{getEquipmentUsageUnit(task.equipment_id)}</span>
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
							Additional log details
							<span class="font-normal text-gray-500 dark:text-gray-400"
								>(notes, cost, parts…)</span
							>
						</summary>
						<div class="space-y-4 border-t border-gray-100 px-3 py-4 dark:border-gray-700">
							<div>
								<label for="complete-task-notes" class={labelClass}>Notes</label>
								<textarea
									id="complete-task-notes"
									bind:value={formData.notes}
									rows="3"
									class={textareaClass}
									placeholder="Any notes about the maintenance performed..."
								></textarea>
							</div>

							<div>
								<label for="complete-task-cost" class={labelClass}>Cost</label>
								<div class={affixRowClass}>
									<span class={affixAddonLeftClass}>$</span>
									<input
										type="number"
										id="complete-task-cost"
										bind:value={formData.cost}
										class={affixInputRightClass}
										placeholder="0.00"
										min="0"
										step="0.01"
									/>
								</div>
							</div>

							<div>
								<label for="complete-task-provider" class={labelClass}>Service provider</label>
								<input
									type="text"
									id="complete-task-provider"
									bind:value={formData.service_provider}
									class={inputClass}
									placeholder="e.g., DIY, Local Garage, Dealer"
								/>
							</div>

							<div>
								<label for="complete-task-parts" class={labelClass}>Parts used</label>
								<div class="mt-1 space-y-2">
									{#if formData.parts_used && formData.parts_used.length > 0}
										<div class="space-y-1">
											{#each formData.parts_used as part, index (part)}
												<div class="flex items-center gap-2">
													<span
														class="flex-1 rounded-md bg-gray-100 px-2 py-1.5 text-sm dark:bg-gray-600 dark:text-white"
														>{part}</span
													>
													<button
														type="button"
														aria-label="Remove part"
														onclick={() => removePart(index)}
														class="shrink-0 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
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
									<div class="flex flex-col gap-2 sm:flex-row">
										<input
											type="text"
											id="complete-task-parts"
											bind:value={newPart}
											onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addPart())}
											class="{inputFieldClass} sm:flex-1"
											placeholder="Add a part..."
										/>
										<button
											type="button"
											onclick={addPart}
											class="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
										>
											Add
										</button>
									</div>
								</div>
							</div>
						</div>
					</details>
				</form>
			{/if}
		{/if}
	{/snippet}

	{#snippet footer()}
		{#if completedLogId}
			<div class={footerButtonRowClass}>
				<button type="button" class={btnPrimaryClass} onclick={closeModal}>Done</button>
			</div>
		{:else}
			<div class={footerButtonRowClass}>
				<button type="button" class={btnCancelClass} onclick={closeModal}>Cancel</button>
				<button
					type="submit"
					form={FORM_ID}
					class={btnPrimaryClass}
					disabled={loading || !task}
				>
					{loading ? 'Completing...' : 'Complete task'}
				</button>
			</div>
		{/if}
	{/snippet}
</ModalShell>
