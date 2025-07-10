<script lang="ts">
	import type { Task, UpdateTaskRequest } from '$lib/types/db.js';

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

			console.log('response', response);

			const updatedTask = await response.json();
			taskUpdated(updatedTask);
			closeModal();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update task';
		} finally {
			loading = false;
		}
	}

	function closeModal() {
		isOpen = false;
		// Reset form
		formData = {
			title: '',
			description: '',
			usage_interval: undefined,
			time_interval_days: undefined,
			priority: 'medium',
			status: 'pending',
			next_due_date: '',
			next_due_usage_value: undefined,
			last_completed_date: '',
			last_completed_usage_value: undefined
		};
		error = '';
		onCloseModal();
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeModal();
		}
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
			class="relative max-h-[90vh] w-96 overflow-y-auto rounded-md border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:shadow-gray-900/50"
		>
			<div class="mt-3">
				<div class="mb-4 flex items-center justify-between">
					<h3 class="text-lg font-medium text-gray-900 dark:text-white">Edit Task</h3>
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
							<option value="low">Low</option>
							<option value="medium">Medium</option>
							<option value="high">High</option>
							<option value="critical">Critical</option>
						</select>
					</div>

					<div>
						<label for="status" class="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Status</label
						>
						<select
							id="status"
							bind:value={formData.status}
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
						>
							<option value="pending">Pending</option>
							<option value="completed">Completed</option>
							<option value="overdue">Overdue</option>
						</select>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div>
							<label
								for="usage_interval"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300"
								>Usage Interval</label
							>
							<input
								type="number"
								id="usage_interval"
								bind:value={formData.usage_interval}
								class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
								placeholder="e.g., 5000"
								min="0"
								step="0.1"
							/>
						</div>

						<div>
							<label
								for="time_interval_days"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300"
								>Time Interval (days)</label
							>
							<input
								type="number"
								id="time_interval_days"
								bind:value={formData.time_interval_days}
								class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
								placeholder="e.g., 90"
								min="0"
							/>
						</div>
					</div>

					<div>
						<label
							for="next_due_date"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Next Due Date</label
						>
						<input
							type="date"
							id="next_due_date"
							bind:value={formData.next_due_date}
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
						/>
					</div>

					<div>
						<label
							for="next_due_usage_value"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Next Due Usage Value</label
						>
						<input
							type="number"
							id="next_due_usage_value"
							bind:value={formData.next_due_usage_value}
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
							placeholder="e.g., 50000"
							min="0"
							step="0.1"
						/>
					</div>

					<div>
						<label
							for="last_completed_date"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Last Completed Date</label
						>
						<input
							type="date"
							id="last_completed_date"
							bind:value={formData.last_completed_date}
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
						/>
					</div>

					<div>
						<label
							for="last_completed_usage_value"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Last Completed Usage Value</label
						>
						<input
							type="number"
							id="last_completed_usage_value"
							bind:value={formData.last_completed_usage_value}
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
							placeholder="e.g., 45000"
							min="0"
							step="0.1"
						/>
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
							class="rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
						>
							{loading ? 'Updating...' : 'Update Task'}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}
