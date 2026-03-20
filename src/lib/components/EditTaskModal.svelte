<script lang="ts">
	import type { Task, UpdateTaskRequest } from '$lib/types/db.js';
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
		responsiveTwoColGridClass,
		selectClass,
		textareaClass
	} from './modalFormStyles.js';

	const FORM_ID = 'edit-task-form';

	let {
		taskUpdated,
		isOpen,
		task,
		onCloseModal
	}: {
		taskUpdated: (task: Task) => void;
		isOpen: boolean;
		task: Task | null;
		onCloseModal: () => void;
	} = $props();

	let formData: UpdateTaskRequest = $state({
		title: '',
		description: '',
		usage_interval: undefined,
		time_interval_days: undefined,
		priority: 'medium',
		status: 'pending',
		remind_days_before: undefined as number | null | undefined,
		next_due_date: '',
		next_due_usage_value: undefined,
		last_completed_date: '',
		last_completed_usage_value: undefined
	});

	let loading = $state(false);
	let error = $state('');

	$effect(() => {
		if (task && isOpen) {
			formData = {
				title: task.title,
				description: task.description || '',
				usage_interval: task.usage_interval,
				time_interval_days: task.time_interval_days,
				priority: task.priority,
				status: task.status,
				remind_days_before:
					(task as Task & { remind_days_before?: number | null }).remind_days_before ?? undefined,
				next_due_date: task.next_due_date || '',
				next_due_usage_value: task.next_due_usage_value,
				last_completed_date: task.last_completed_date || '',
				last_completed_usage_value: task.last_completed_usage_value
			};
		}
	});

	async function handleSubmit() {
		if (!formData.title || !task) {
			error = 'Title is required';
			return;
		}

		try {
			loading = true;
			error = '';

			const response = await fetch(`/api/tasks/${task.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(formData)
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to update task');
			}

			const updatedTask = (await response.json()) as Task;
			taskUpdated(updatedTask);
			closeModal();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update task';
		} finally {
			loading = false;
		}
	}

	function closeModal() {
		formData = {
			title: '',
			description: '',
			usage_interval: undefined,
			time_interval_days: undefined,
			priority: 'medium',
			status: 'pending',
			remind_days_before: undefined,
			next_due_date: '',
			next_due_usage_value: undefined,
			last_completed_date: '',
			last_completed_usage_value: undefined
		};
		error = '';
		onCloseModal();
	}

	function onFormSubmit(e: SubmitEvent) {
		e.preventDefault();
		handleSubmit();
	}

	const shellOpen = $derived(isOpen && task != null);
</script>

<ModalShell open={shellOpen} onClose={closeModal} titleId="edit-task-modal-title" size="lg">
	{#snippet title()}Edit Task{/snippet}

	{#snippet children()}
		{#if task}
			<form id={FORM_ID} class="space-y-4" onsubmit={onFormSubmit}>
				{#if error}
					<div class={errorAlertClass}>
						<p class={errorTextClass}>{error}</p>
					</div>
				{/if}

				<div>
					<label for="edit-task-title" class={labelClass}>Title *</label>
					<input
						type="text"
						id="edit-task-title"
						bind:value={formData.title}
						class={inputClass}
						placeholder="e.g., Oil Change, Filter Replacement"
						required
					/>
				</div>

				<div>
					<label for="edit-task-description" class={labelClass}>Description</label>
					<textarea
						id="edit-task-description"
						bind:value={formData.description}
						rows="3"
						class={textareaClass}
						placeholder="Optional description of the task"
					></textarea>
				</div>

				<div class={responsiveTwoColGridClass}>
					<div>
						<label for="edit-task-priority" class={labelClass}>Priority</label>
						<select id="edit-task-priority" bind:value={formData.priority} class={selectClass}>
							<option value="low">Low</option>
							<option value="medium">Medium</option>
							<option value="high">High</option>
							<option value="critical">Critical</option>
						</select>
					</div>

					<div>
						<label for="edit-task-status" class={labelClass}>Status</label>
						<select id="edit-task-status" bind:value={formData.status} class={selectClass}>
							<option value="pending">Pending</option>
							<option value="completed">Completed</option>
							<option value="overdue">Overdue</option>
						</select>
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
						Scheduling
						<span class="font-normal text-gray-500 dark:text-gray-400"
							>(intervals, due dates, history)</span
						>
					</summary>
					<div class="space-y-4 border-t border-gray-100 px-3 py-4 dark:border-gray-700">
						<div class={responsiveTwoColGridClass}>
							<div>
								<label for="edit-task-usage-interval" class={labelClass}>Usage interval</label>
								<input
									type="number"
									id="edit-task-usage-interval"
									bind:value={formData.usage_interval}
									class={inputClass}
									placeholder="e.g., 5000"
									min="0"
									step="0.1"
								/>
							</div>

							<div>
								<label for="edit-task-time-interval" class={labelClass}>Time interval (days)</label>
								<input
									type="number"
									id="edit-task-time-interval"
									bind:value={formData.time_interval_days}
									class={inputClass}
									placeholder="e.g., 90"
									min="0"
								/>
							</div>
						</div>

						<div>
							<label for="edit-task-next-due-date" class={labelClass}>Next due date</label>
							<input
								type="date"
								id="edit-task-next-due-date"
								bind:value={formData.next_due_date}
								class={inputClass}
							/>
						</div>

						<div>
							<label for="edit-task-next-due-usage" class={labelClass}>Next due usage value</label>
							<input
								type="number"
								id="edit-task-next-due-usage"
								bind:value={formData.next_due_usage_value}
								class={inputClass}
								placeholder="e.g., 50000"
								min="0"
								step="0.1"
							/>
						</div>

						<div class={responsiveTwoColGridClass}>
							<div>
								<label for="edit-task-last-completed-date" class={labelClass}
									>Last completed date</label
								>
								<input
									type="date"
									id="edit-task-last-completed-date"
									bind:value={formData.last_completed_date}
									class={inputClass}
								/>
							</div>

							<div>
								<label for="edit-task-last-completed-usage" class={labelClass}
									>Last completed usage</label
								>
								<input
									type="number"
									id="edit-task-last-completed-usage"
									bind:value={formData.last_completed_usage_value}
									class={inputClass}
									placeholder="e.g., 45000"
									min="0"
									step="0.1"
								/>
							</div>
						</div>
					</div>
				</details>

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
						Notifications
					</summary>
					<div class="space-y-2 border-t border-gray-100 px-3 py-4 dark:border-gray-700">
						<label for="edit-task-remind-days" class={labelClass}>Remind me (days before due)</label>
						<input
							type="number"
							id="edit-task-remind-days"
							bind:value={formData.remind_days_before}
							class={inputClass}
							placeholder="Use global settings"
							min="0"
							step="1"
						/>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Leave empty to use notification settings. Set a number to get a reminder that many days
							before due.
						</p>
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
				disabled={loading || !task}
			>
				{loading ? 'Updating...' : 'Update Task'}
			</button>
		</div>
	{/snippet}
</ModalShell>
