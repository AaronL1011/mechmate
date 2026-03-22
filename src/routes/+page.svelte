<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { DashboardLoadData } from './+page';
	import type { Task, MaintenanceLog } from '$lib/types/db.js';
	import CompleteTaskModal from '$lib/components/CompleteTaskModal.svelte';
	import ProactiveSuggestions from '$lib/components/ProactiveSuggestions.svelte';
	import UpcomingTasksListView from '$lib/components/UpcomingTasksListView.svelte';
	import UpcomingTasksCalendarView from '$lib/components/UpcomingTasksCalendarView.svelte';
	import {
		mechAssistantLaunch,
		requestOpenAddEquipmentModal,
		requestOpenAddTaskModal
	} from '$lib/stores/mechAssistantLaunch';

	let { data }: { data: DashboardLoadData } = $props();

	let viewMode = $state<'list' | 'calendar'>('list');

	let showCompleteTaskModal = $state(false);
	let selectedTask: Task | null = $state(null);

	const stats = $derived(data.stats);
	const upcomingTasks = $derived(data.upcomingTasks);
	const equipment = $derived(data.equipment);
	const dueSoonTasks = $derived(data.dueSoonTasks);
	const proactiveSuggestions = $derived(data.proactiveSuggestions);
	const settings = $derived(data.settings);
	const error = $derived(data.error ?? '');

	function openCompleteTaskModal(task: Task) {
		selectedTask = task;
		showCompleteTaskModal = true;
	}

	function handleTaskCompleted(_result: {
		updated_task: Task;
		maintenance_log: MaintenanceLog;
		message: string;
	}) {
		invalidateAll();
	}
</script>

<svelte:head>
	<title>Mechmate - Maintenance Dashboard</title>
</svelte:head>

<main class="mx-auto max-w-7xl pb-16">
	{#if error}
		<div
			class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
		>
			<p class="text-red-800 dark:text-red-200">{error}</p>
			<button
				onclick={() => invalidateAll()}
				class="mt-2 text-red-600 underline hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
			>
				Try again
			</button>
		</div>
	{:else}
		<!-- Stats Section -->
		{#if stats}
			<div class="mb-8 grid auto-rows-[1fr] grid-cols-2 gap-2 md:grid-cols-4 md:gap-6">
				<div
					class="rounded-lg bg-white p-4 shadow md:p-6 dark:bg-gray-800 dark:shadow-gray-900/20"
				>
					<div class="flex h-full items-center gap-4">
						<div class="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-6 w-6 text-emerald-600 dark:text-emerald-400"
								fill="currentColor"
								stroke="currentColor"
								viewBox="0 0 256 256"
								><path
									d="M200,32H163.74a47.92,47.92,0,0,0-71.48,0H56A16,16,0,0,0,40,48V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm-72,0a32,32,0,0,1,32,32H96A32,32,0,0,1,128,32Zm72,184H56V48H82.75A47.93,47.93,0,0,0,80,64v8a8,8,0,0,0,8,8h80a8,8,0,0,0,8-8V64a47.93,47.93,0,0,0-2.75-16H200Z"
								></path></svg
							>
						</div>
						<div>
							<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Upcoming</p>
							<p class="text-2xl font-bold text-gray-900 dark:text-white">
								{stats.upcoming_jobs}
							</p>
						</div>
					</div>
				</div>

				<div
					class="rounded-lg bg-white p-4 shadow md:p-6 dark:bg-gray-800 dark:shadow-gray-900/20"
				>
					<div class="flex h-full items-center gap-4">
						<div class="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-6 w-6 text-red-600 dark:text-red-400"
								fill="currentColor"
								viewBox="0 0 256 256"
								><path
									d="M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z"
								></path></svg
							>
						</div>
						<div>
							<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Overdue</p>
							<p class="text-2xl font-bold text-gray-900 dark:text-white">{stats.overdue_jobs}</p>
						</div>
					</div>
				</div>

				<a
					href="/equipment"
					class="group block rounded-lg border border-blue-200/80 bg-white p-4 shadow transition-[border-color,box-shadow,background-color] hover:border-blue-400 hover:bg-blue-50/60 hover:shadow-md active:border-blue-400 active:bg-blue-50/70 active:shadow-sm dark:border-blue-800/55 dark:bg-gray-800 dark:hover:border-blue-500 dark:hover:bg-blue-900/25 dark:active:border-blue-500 dark:active:bg-blue-900/35 dark:shadow-gray-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 md:p-6"
					aria-label="View equipment"
				>
					<div class="flex h-full items-center gap-4">
						<div class="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-6 w-6 text-blue-600 dark:text-blue-400"
								fill="currentColor"
								viewBox="0 0 256 256"
								aria-hidden="true"
								><path
									d="M240,192h-8V98.67a16,16,0,0,0-7.12-13.31l-88-58.67a16,16,0,0,0-17.75,0l-88,58.67A16,16,0,0,0,24,98.67V192H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM40,98.67,128,40l88,58.66V192H192V136a8,8,0,0,0-8-8H72a8,8,0,0,0-8,8v56H40ZM176,144v16H136V144Zm-56,16H80V144h40ZM80,176h40v16H80Zm56,0h40v16H136Z"
								></path></svg
							>
						</div>
						<div>
							<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Equipment</p>
							<p class="text-2xl font-bold text-gray-900 dark:text-white">
								{stats.total_equipment}
							</p>
						</div>
						<div class="ml-auto flex shrink-0 items-center self-stretch">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								fill="currentColor"
								viewBox="0 0 256 256"
								class="text-blue-600 transition-colors group-hover:text-blue-800 group-active:text-blue-800 dark:text-blue-400 dark:group-hover:text-blue-300 dark:group-active:text-blue-300"
								aria-hidden="true"
								><path
									d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"
								></path></svg
							>
						</div>
					</div>
				</a>

				<a
					href="/tasks"
					class="group block rounded-lg border border-blue-200/80 bg-white p-4 shadow transition-[border-color,box-shadow,background-color] hover:border-blue-400 hover:bg-blue-50/60 hover:shadow-md active:border-blue-400 active:bg-blue-50/70 active:shadow-sm dark:border-blue-800/55 dark:bg-gray-800 dark:hover:border-blue-500 dark:hover:bg-blue-900/25 dark:active:border-blue-500 dark:active:bg-blue-900/35 dark:shadow-gray-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 md:p-6"
					aria-label="View tasks"
				>
					<div class="flex h-full items-center gap-4">
						<div class="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-6 w-6 text-purple-600 dark:text-purple-400"
								fill="currentColor"
								viewBox="0 0 256 256"
								aria-hidden="true"
								><path
									d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"
								></path></svg
							>
						</div>
						<div>
							<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Tasks</p>
							<p class="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_tasks}</p>
						</div>
						<div class="ml-auto flex shrink-0 items-center self-stretch">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								fill="currentColor"
								viewBox="0 0 256 256"
								class="text-blue-600 transition-colors group-hover:text-blue-800 group-active:text-blue-800 dark:text-blue-400 dark:group-hover:text-blue-300 dark:group-active:text-blue-300"
								aria-hidden="true"
								><path
									d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"
								></path></svg
							>
						</div>
					</div>
				</a>
			</div>
		{/if}

		{#if dueSoonTasks.length > 0}
			<div class="mb-8 rounded-lg bg-white p-4 shadow dark:bg-gray-800 dark:shadow-gray-900/20">
				<h2 class="mb-3 text-base font-semibold text-gray-900 sm:text-lg dark:text-white">
					Due this week
				</h2>
				<ul class="space-y-2">
					{#each dueSoonTasks as task (task.id)}
						<li
							class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-100 py-2 px-3 dark:border-gray-700"
						>
							<span class="text-sm text-gray-700 dark:text-gray-300">
								{task.title}
								{#if task.equipment_name}
									<span class="text-gray-500 dark:text-gray-400"> · {task.equipment_name}</span>
								{/if}
								{#if task.next_due_date}
									<span class="text-gray-500 dark:text-gray-400">
										· due {new Date(task.next_due_date).toLocaleDateString()}
									</span>
								{/if}
							</span>
							<button
								type="button"
								class="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-200/80 bg-white/80 px-2.5 py-1 text-xs font-medium text-emerald-800 transition-colors hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800/70 dark:bg-transparent dark:text-emerald-300 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/35"
								onclick={() => openCompleteTaskModal(task)}
							>
								<svg
									class="h-3.5 w-3.5 shrink-0 opacity-90"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									></path>
								</svg>
								Complete
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<ProactiveSuggestions
			suggestions={proactiveSuggestions}
			onDismiss={() => invalidateAll()}
			onApprove={(action) => {
				mechAssistantLaunch.set({ prompt: action });
			}}
		/>

		<!-- View Mode Toggle -->
		<div class="mb-6 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<h2 class="text-lg font-bold text-gray-900 lg:text-2xl dark:text-white">Upcoming</h2>
				{#if settings?.upcoming_task_range_days}
					<p class="translate-y-0.5 text-xs text-gray-400 sm:text-sm">
						{settings.upcoming_task_range_days} days
					</p>
				{/if}
			</div>
			<div class="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
				<button
					aria-label="List view"
					class="rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors {viewMode ===
					'list'
						? 'bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white'
						: 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}"
					onclick={() => (viewMode = 'list')}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						fill="currentColor"
						viewBox="0 0 256 256"
						><path
							d="M224,128a8,8,0,0,1-8,8H128a8,8,0,0,1,0-16h88A8,8,0,0,1,224,128ZM128,72h88a8,8,0,0,0,0-16H128a8,8,0,0,0,0,16Zm88,112H128a8,8,0,0,0,0,16h88a8,8,0,0,0,0-16ZM82.34,42.34,56,68.69,45.66,58.34A8,8,0,0,0,34.34,69.66l16,16a8,8,0,0,0,11.32,0l32-32A8,8,0,0,0,82.34,42.34Zm0,64L56,132.69,45.66,122.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32,0l32-32a8,8,0,0,0-11.32-11.32Zm0,64L56,196.69,45.66,186.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32,0l32-32a8,8,0,0,0-11.32-11.32Z"
						></path></svg
					>
				</button>
				<button
					aria-label="Calendar view"
					class="rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors {viewMode ===
					'calendar'
						? 'bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white'
						: 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}"
					onclick={() => (viewMode = 'calendar')}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						fill="currentColor"
						viewBox="0 0 256 256"
						><path
							d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-68-76a12,12,0,1,1-12-12A12,12,0,0,1,140,132Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,184,132ZM96,172a12,12,0,1,1-12-12A12,12,0,0,1,96,172Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,140,172Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,184,172Z"
						></path></svg
					>
				</button>
			</div>
		</div>

		{#if viewMode === 'list'}
			<UpcomingTasksListView
				upcomingTasks={upcomingTasks}
				{stats}
				{equipment}
				taskTypes={data.taskTypes}
				onCompleteTask={openCompleteTaskModal}
				onAddEquipment={() => requestOpenAddEquipmentModal.set(true)}
				onAddTask={() => requestOpenAddTaskModal.set(true)}
			/>
		{/if}
		{#if viewMode === 'calendar'}
			<UpcomingTasksCalendarView
				upcomingTasks={upcomingTasks}
				{equipment}
				onCompleteTask={openCompleteTaskModal}
			/>
		{/if}
	{/if}
</main>

<CompleteTaskModal
	isOpen={showCompleteTaskModal}
	task={selectedTask}
	{equipment}
	taskCompleted={handleTaskCompleted}
	onCloseModal={() => (showCompleteTaskModal = false)}
/>
