<script lang="ts">
	import { onMount } from 'svelte';
	import type { Task, Equipment, TaskType, MaintenanceLog } from '$lib/types/db.js';
	import EditTaskModal from '$lib/components/EditTaskModal.svelte';
	import DeleteConfirmationModal from '$lib/components/DeleteConfirmationModal.svelte';
	import CompleteTaskModal from '$lib/components/CompleteTaskModal.svelte';
	import TaskManagementListItem from '$lib/components/TaskManagementListItem.svelte';
	import {
		BUCKET_LABELS,
		countByBucket,
		groupTasksByBucket,
		type TaskDueBucket
	} from '$lib/utils/taskBuckets.js';

	let tasks = $state<Task[]>([]);
	let equipment = $state<Equipment[]>([]);
	let taskTypes = $state<TaskType[]>([]);
	let loading = $state(true);
	let error = $state('');

	let showEditModal = $state(false);
	let showDeleteModal = $state(false);
	let showCompleteModal = $state(false);
	let selectedTask = $state<Task | null>(null);

	let searchQuery = $state('');
	let filterPriority = $state<'all' | Task['priority']>('all');
	let filterEquipmentId = $state<string>('all');
	let hideCompleted = $state(false);

	const summaryBuckets: TaskDueBucket[] = [
		'overdue',
		'due_today',
		'due_this_week',
		'later',
	];

	const summaryAccent: Partial<Record<TaskDueBucket, string>> = {
		overdue: 'border-red-200 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30',
		due_today: 'border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/25',
		due_this_week: 'border-amber-100 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20'
	};

	const listBuckets: TaskDueBucket[] = [
		'overdue',
		'due_today',
		'due_this_week',
		'later',
		'no_due_date'
	];

	function getEquipmentName(equipmentId: number): string {
		return equipment.find((e) => e.id === equipmentId)?.name || 'Unknown Equipment';
	}

	function getTaskTypeName(taskTypeId: number): string {
		return taskTypes.find((t) => t.id === taskTypeId)?.name || 'Unknown Task';
	}

	const equipmentOptions = $derived(
		[...equipment].sort((a, b) => a.name.localeCompare(b.name))
	);

	const filteredTasks = $derived.by(() => {
		let list = tasks;
		const q = searchQuery.trim().toLowerCase();
		if (q) {
			list = list.filter((t) => {
				const en = getEquipmentName(t.equipment_id).toLowerCase();
				const tn = getTaskTypeName(t.task_type_id).toLowerCase();
				return (
					t.title.toLowerCase().includes(q) ||
					en.includes(q) ||
					tn.includes(q) ||
					(t.description?.toLowerCase().includes(q) ?? false)
				);
			});
		}
		if (filterPriority !== 'all') {
			list = list.filter((t) => t.priority === filterPriority);
		}
		if (filterEquipmentId !== 'all') {
			const eqId = Number(filterEquipmentId);
			list = list.filter((t) => t.equipment_id === eqId);
		}
		if (hideCompleted) {
			list = list.filter((t) => t.status !== 'completed');
		}
		return list;
	});

	const bucketCounts = $derived(countByBucket(filteredTasks));
	const grouped = $derived(groupTasksByBucket(filteredTasks));

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

	function openCompleteModal(task: Task) {
		selectedTask = task;
		showCompleteModal = true;
	}

	function handleTaskUpdated(updatedTask: Task) {
		tasks = tasks.map((task) => (task.id === updatedTask.id ? updatedTask : task));
		showEditModal = false;
		selectedTask = null;
	}

	function handleTaskDeleted(deletedId: number) {
		tasks = tasks.filter((task) => task.id !== deletedId);
		showDeleteModal = false;
		selectedTask = null;
	}

	function handleTaskCompleted(result: {
		updated_task: Task;
		maintenance_log: MaintenanceLog;
		message: string;
	}) {
		tasks = tasks.map((t) => (t.id === result.updated_task.id ? result.updated_task : t));
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

			handleTaskDeleted(selectedTask.id);
		} catch (err) {
			console.error('Error deleting task:', err);
		}
	}

	onMount(() => {
		loadData();
	});
</script>

<svelte:head>
	<title>Task Management - Mechmate</title>
</svelte:head>

<header class="mx-auto my-8 pl-4 max-w-7xl">
	<h1 class="text-2xl font-bold text-gray-900 lg:text-3xl dark:text-white">Tasks</h1>
	<p class="mt-1 text-gray-600 dark:text-gray-300">
		Review, complete and manage maintenance tasks
	</p>
</header>

<main class="mx-auto max-w-7xl px-4 pb-12">
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
				type="button"
				onclick={loadData}
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
		<div class="space-y-6">
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
				{#each summaryBuckets as key (key)}
					{@const accent = summaryAccent[key]}
					<div
						class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-gray-900/20 {accent ??
							''}"
					>
						<p class="text-xs font-medium text-gray-500 dark:text-gray-400">
							{BUCKET_LABELS[key]}
						</p>
						<p class="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
							{bucketCounts[key]}
						</p>
					</div>
				{/each}
			</div>

			<div
				class="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-gray-900/20 lg:flex-row lg:flex-wrap lg:items-end"
			>
				<div class="min-w-[min(100%,14rem)] flex-1">
					<label
						for="task-search"
						class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
						>Search</label
					>
					<input
						id="task-search"
						type="search"
						placeholder="Title, equipment, type…"
						bind:value={searchQuery}
						class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
					/>
				</div>
				<div class="w-full min-w-[10rem] sm:w-auto">
					<label
						for="task-priority"
						class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Priority</label
					>
					<select
						id="task-priority"
						bind:value={filterPriority}
						class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white sm:w-40"
					>
						<option value="all">All priorities</option>
						<option value="low">Low</option>
						<option value="medium">Medium</option>
						<option value="high">High</option>
						<option value="critical">Critical</option>
					</select>
				</div>
				<div class="w-full min-w-[12rem] sm:w-auto">
					<label
						for="task-equipment"
						class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
						>Equipment</label
					>
					<select
						id="task-equipment"
						bind:value={filterEquipmentId}
						class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white sm:min-w-[12rem]"
					>
						<option value="all">All equipment</option>
						{#each equipmentOptions as eq (eq.id)}
							<option value={String(eq.id)}>{eq.name}</option>
						{/each}
					</select>
				</div>
				<div class="flex items-center gap-2 pb-0.5 lg:pb-2">
					<input
						id="hide-completed"
						type="checkbox"
						bind:checked={hideCompleted}
						class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
					/>
					<label for="hide-completed" class="text-sm text-gray-700 dark:text-gray-300">
						Hide completed
					</label>
				</div>
			</div>

			{#if filteredTasks.length === 0}
				<div
					class="rounded-lg border border-dashed border-gray-300 bg-gray-50/80 p-10 text-center dark:border-gray-600 dark:bg-gray-800/50"
				>
					<p class="text-sm font-medium text-gray-900 dark:text-white">No tasks match your filters</p>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Try clearing search or changing filters.
					</p>
					<button
						type="button"
						class="mt-4 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
						onclick={() => {
							searchQuery = '';
							filterPriority = 'all';
							filterEquipmentId = 'all';
							hideCompleted = false;
						}}
					>
						Reset filters
					</button>
				</div>
			{:else}
				<div class="space-y-10">
					{#each listBuckets as bucketKey (bucketKey)}
						{@const sectionTasks = grouped.get(bucketKey) ?? []}
						{#if sectionTasks.length > 0}
							<section aria-labelledby="heading-{bucketKey}">
								<h2
									id="heading-{bucketKey}"
									class="mb-3 text-lg font-semibold text-gray-900 dark:text-white"
								>
									{BUCKET_LABELS[bucketKey]}
									<span class="ml-2 text-base font-normal text-gray-500 dark:text-gray-400">
										({sectionTasks.length})
									</span>
								</h2>
								<ul class="space-y-3">
									{#each sectionTasks as task (task.id)}
										<TaskManagementListItem
											{task}
											equipmentName={getEquipmentName(task.equipment_id)}
											taskTypeName={getTaskTypeName(task.task_type_id)}
											bucket={bucketKey}
											onEdit={() => openEditModal(task)}
											onDelete={() => openDeleteModal(task)}
											onComplete={() => openCompleteModal(task)}
										/>
									{/each}
								</ul>
							</section>
						{/if}
					{/each}

					{#if !hideCompleted && (grouped.get('completed') ?? []).length > 0}
						<details
							class="group rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-gray-900/20"
						>
							<summary
								class="cursor-pointer list-none px-4 py-3 text-lg font-semibold text-gray-900 marker:hidden dark:text-white sm:px-5 [&::-webkit-details-marker]:hidden"
							>
								<span class="inline-flex items-center gap-2">
									{BUCKET_LABELS.completed}
									<span class="text-base font-normal text-gray-500 dark:text-gray-400">
										({grouped.get('completed')?.length ?? 0})
									</span>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-5 w-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180 dark:text-gray-500"
										fill="currentColor"
										viewBox="0 0 256 256"
										aria-hidden="true"
										><path
											d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"
										></path></svg
									>
								</span>
							</summary>
							<div class="border-t border-gray-100 px-4 pb-4 pt-2 dark:border-gray-700 sm:px-5">
								<ul class="space-y-3">
									{#each grouped.get('completed') ?? [] as task (task.id)}
										<TaskManagementListItem
											{task}
											equipmentName={getEquipmentName(task.equipment_id)}
											taskTypeName={getTaskTypeName(task.task_type_id)}
											bucket="completed"
											onEdit={() => openEditModal(task)}
											onDelete={() => openDeleteModal(task)}
											onComplete={() => openCompleteModal(task)}
										/>
									{/each}
								</ul>
							</div>
						</details>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</main>

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

<CompleteTaskModal
	isOpen={showCompleteModal}
	task={selectedTask}
	{equipment}
	taskCompleted={handleTaskCompleted}
	onCloseModal={() => {
		showCompleteModal = false;
		selectedTask = null;
	}}
/>
