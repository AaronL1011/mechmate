<script lang="ts">
	import { onMount } from 'svelte';
	import type { Task, Equipment, TaskType } from '$lib/types/db.js';
	import EditTaskModal from '$lib/components/EditTaskModal.svelte';
	import DeleteConfirmationModal from '$lib/components/DeleteConfirmationModal.svelte';

	let tasks: Task[] = [];
	let equipment: Equipment[] = [];
	let taskTypes: TaskType[] = [];
	let loading = true;
	let error = '';

	// Modal states
	let showEditModal = false;
	let showDeleteModal = false;
	let selectedTask: Task | null = null;

	const priorityColors = {
		low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
		medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
		high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
		critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
	};

	const statusColors = {
		pending: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
		overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
		completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
	};

	async function loadData() {
		try {
			loading = true;
			const [tasksRes, equipmentRes, taskTypesRes] = await Promise.all([
				fetch('/api/tasks'),
				fetch('/api/equipment'),
				fetch('/api/task-types')
			]);

			if (!tasksRes.ok || !equipmentRes.ok || !taskTypesRes.ok) {
				throw new Error('Failed to load data');
			}

			tasks = await tasksRes.json();
			equipment = await equipmentRes.json();
			taskTypes = await taskTypesRes.json();
		} catch (err) {
			error = 'Failed to load tasks data';
			console.error(err);
		} finally {
			loading = false;
		}
	}

	function openEditModal(task: Task) {
		selectedTask = task;
		showEditModal = true;
	}

	function openDeleteModal(task: Task) {
		selectedTask = task;
		showDeleteModal = true;
	}

	function handleTaskUpdated(updatedTask: Task) {
		tasks = tasks.map((task) => (task.id === updatedTask.id ? updatedTask : task));
		showEditModal = false;
		selectedTask = null;
	}

	function handleTaskDeleted(event: CustomEvent) {
		const deletedId = event.detail;
		tasks = tasks.filter((task) => task.id !== deletedId);
		showDeleteModal = false;
		selectedTask = null;
	}

	async function handleDeleteConfirm() {
		if (!selectedTask) return;

		try {
			const response = await fetch(`/api/tasks/${selectedTask.id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to delete task');
			}

			handleTaskDeleted({ detail: selectedTask.id } as CustomEvent);
		} catch (err) {
			console.error('Error deleting task:', err);
			// Could show an error message here
		}
	}

	function getEquipmentName(equipmentId: number): string {
		return equipment.find((e) => e.id === equipmentId)?.name || 'Unknown Equipment';
	}

	function getTaskTypeName(taskTypeId: number): string {
		return taskTypes.find((t) => t.id === taskTypeId)?.name || 'Unknown Task';
	}

	function formatDate(dateString: string | null): string {
		if (!dateString) return 'No date set';
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function getDaysUntilDue(dateString: string | null): number {
		if (!dateString) return 0;
		const dueDate = new Date(dateString);
		const today = new Date();
		const diffTime = dueDate.getTime() - today.getTime();
		return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
	}

	onMount(() => {
		loadData();
	});
</script>

<svelte:head>
	<title>Task Management - Mechmate</title>
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
					Task Management
				</h1>
				<p class="text-gray-600 dark:text-gray-300">Inspect, modify or erase current tasks</p>
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
					on:click={loadData}
					class="mt-2 text-red-600 underline hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
				>
					Try again
				</button>
			</div>
		{:else if tasks.length === 0}
			<div
				class="rounded-lg bg-white p-12 text-center shadow dark:bg-gray-800 dark:shadow-gray-900/20"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
					fill="currentColor"
					viewBox="0 0 256 256"
					><path
						d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"
					></path></svg
				>
				<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No tasks found</h3>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					Get started by adding some maintenance tasks.
				</p>
				<div class="mt-6">
					<a
						href="/"
						class="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
					>
						Add your first task
					</a>
				</div>
			</div>
		{:else}
			<div
				class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800 dark:shadow-gray-900/20"
			>
				<ul class="divide-y divide-gray-200 dark:divide-gray-700">
					{#each tasks as task (task.id)}
						{@const equipmentName = getEquipmentName(task.equipment_id)}
						{@const taskTypeName = getTaskTypeName(task.task_type_id)}
						{@const daysUntilDue = getDaysUntilDue(task.next_due_date || null)}
						{@const isOverdue = daysUntilDue < 0}

						<li class="px-6 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700">
							<div class="flex flex-wrap items-center justify-between gap-y-4">
								<div class="flex min-w-[300px] flex-1 items-center">
									<div class="ml-4 flex-1">
										<div class="flex items-center justify-between">
											<div>
												<div class="flex flex-col items-start space-x-2">
													<h3 class="text-lg font-medium text-gray-900 dark:text-white">
														{task.title}
													</h3>
													<br />
													<p class="text-sm text-gray-600 dark:text-gray-300">
														{equipmentName} • {taskTypeName}
													</p>

													<div class="flex flex-wrap items-center space-x-2 py-1">
														<span
															class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {priorityColors[
																task.priority
															]} capitalize"
														>
															{task.priority}
														</span>
														<span
															class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {statusColors[
																task.status
															]} capitalize"
														>
															{task.status}
														</span>
														{#if isOverdue}
															<span
																class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-200"
															>
																Overdue
															</span>
														{/if}
													</div>
												</div>
												{#if task.description}
													<p class="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
														{task.description}
													</p>
												{/if}
												<div
													class="mt-1 flex items-center space-x-4 text-xs text-gray-500 lg:text-sm dark:text-gray-400"
												>
													{#if task.next_due_date}
														<span>
															{#if isOverdue}
																{Math.abs(daysUntilDue)} days overdue
															{:else if daysUntilDue === 0}
																Due today
															{:else}
																Due in {daysUntilDue} days
															{/if}
														</span>
														<span>•</span>
														<span>{formatDate(task.next_due_date)}</span>
													{/if}
													{#if task.usage_interval}
														<span>•</span>
														<span>Every {task.usage_interval} units</span>
													{/if}
													{#if task.time_interval_days}
														<span>•</span>
														<span>Every {task.time_interval_days} days</span>
													{/if}
												</div>
											</div>
										</div>
									</div>
								</div>
								<div class="ml-auto flex items-center space-x-2">
									<button
										class="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
										on:click={() => openEditModal(task)}
									>
										Edit
									</button>
									<button
										class="rounded bg-red-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
										on:click={() => openDeleteModal(task)}
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

<EditTaskModal
	isOpen={showEditModal}
	task={selectedTask}
	taskUpdated={handleTaskUpdated}
	onCloseModal={() => {
		showEditModal = false;
		selectedTask = null;
	}}
/>

<DeleteConfirmationModal
	isOpen={showDeleteModal}
	title="Delete Task"
	message="Are you sure you want to delete this task? This action cannot be undone."
	onConfirm={handleDeleteConfirm}
	onCancel={() => {
		showDeleteModal = false;
		selectedTask = null;
	}}
/>
