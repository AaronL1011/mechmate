<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import type { DashboardLoadData } from './+page';
	import type { Task, MaintenanceLog } from '$lib/types/db.js';
	import AddEquipmentModal from '$lib/components/AddEquipmentModal.svelte';
	import AddTaskModal from '$lib/components/AddTaskModal.svelte';
	import CompleteTaskModal from '$lib/components/CompleteTaskModal.svelte';
	import MechAssistant from '$lib/components/MechAssistant.svelte';
	import ProactiveSuggestions from '$lib/components/ProactiveSuggestions.svelte';
	import UpcomingTasksListView from '$lib/components/UpcomingTasksListView.svelte';
	import UpcomingTasksCalendarView from '$lib/components/UpcomingTasksCalendarView.svelte';

	let { data }: { data: DashboardLoadData } = $props();

	let viewMode = $state<'list' | 'calendar'>('list');

	// Modal states
	let showAddEquipmentModal = $state(false);
	let showAddTaskModal = $state(false);
	let showCompleteTaskModal = $state(false);
	let showMechAssistant = $state(false);
	let mechAssistantInitialPrompt = $state<string | undefined>(undefined);
	let selectedTask: Task | null = $state(null);
	let showDropdown = $state(false);

	const stats = $derived(data.stats);
	const upcomingTasks = $derived(data.upcomingTasks);
	const equipment = $derived(data.equipment);
	const equipmentTypes = $derived(data.equipmentTypes);
	const taskTypes = $derived(data.taskTypes);
	const dueSoonTasks = $derived(data.dueSoonTasks);
	const proactiveSuggestions = $derived(data.proactiveSuggestions);
	const settings = $derived(data.settings);
	const error = $derived(data.error ?? '');

	function openCompleteTaskModal(task: Task) {
		selectedTask = task;
		showCompleteTaskModal = true;
	}

	function handleEquipmentCreated(_event: CustomEvent) {
		invalidateAll();
	}

	function handleTaskCreated(_event: CustomEvent) {
		invalidateAll();
	}

	function handleTaskCompleted(_result: {
		updated_task: Task;
		maintenance_log: MaintenanceLog;
		message: string;
	}) {
		invalidateAll();
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.split-button-container')) {
			showDropdown = false;
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);

		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<svelte:head>
	<title>Mechmate - Maintenance Dashboard</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8 dark:bg-gray-900">
	<!-- Header -->
	<header
		class="mb-4 max-w-7xl rounded-lg border-gray-200 bg-white shadow-sm lg:mx-auto dark:border-gray-700 dark:bg-gray-800"
	>
		<div class="px-4 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between space-x-4 py-4">
				<div class="flex items-center gap-4">
					<img src="/robot.png" alt="mechmate" class="h-10 w-10" />
					<h1 class="text-xl font-bold text-gray-900 lg:text-2xl dark:text-white">Mechmate</h1>
				</div>
				<div class="flex items-center space-x-2 lg:space-x-4">
					<a
						href="/settings"
						class="p-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
						aria-label="Settings"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							fill="currentColor"
							viewBox="0 0 256 256"
						>
							<path
								d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.21,107.21,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.71,107.71,0,0,0-26.25-10.87,8,8,0,0,0-7.06,1.49L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.21,107.21,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06Zm-16.1-6.5a73.93,73.93,0,0,1,0,8.68,8,8,0,0,0,1.74,5.48l14.19,17.73a91.57,91.57,0,0,1-6.23,15L187,173.11a8,8,0,0,0-5.1,2.64,74.11,74.11,0,0,1-6.14,6.14,8,8,0,0,0-2.64,5.1l-2.51,22.58a91.32,91.32,0,0,1-15,6.23l-17.74-14.19a8,8,0,0,0-5-1.75h-.48a73.93,73.93,0,0,1-8.68,0,8,8,0,0,0-5.48,1.74L100.45,215.8a91.57,91.57,0,0,1-15-6.23L82.89,187a8,8,0,0,0-2.64-5.1,74.11,74.11,0,0,1-6.14-6.14,8,8,0,0,0-5.1-2.64L46.43,170.6a91.32,91.32,0,0,1-6.23-15l14.19-17.74a8,8,0,0,0,1.74-5.48,73.93,73.93,0,0,1,0-8.68,8,8,0,0,0-1.74-5.48L40.2,100.45a91.57,91.57,0,0,1,6.23-15L69,82.89a8,8,0,0,0,5.1-2.64,74.11,74.11,0,0,1,6.14-6.14A8,8,0,0,0,82.89,69L85.4,46.43a91.32,91.32,0,0,1,15-6.23l17.74,14.19a8,8,0,0,0,5.48,1.74,73.93,73.93,0,0,1,8.68,0,8,8,0,0,0,5.48-1.74L155.55,40.2a91.57,91.57,0,0,1,15,6.23L173.11,69a8,8,0,0,0,2.64,5.1,74.11,74.11,0,0,1,6.14,6.14,8,8,0,0,0,5.1,2.64l22.58,2.51a91.32,91.32,0,0,1,6.23,15l-14.19,17.74A8,8,0,0,0,199.87,123.66Z"
							></path>
						</svg>
					</a>

					<div class="split-button-container relative inline-flex rounded-lg shadow-sm">
						<!-- Main button -->
						<button
							class="rounded-l-lg border-r border-blue-500 bg-blue-600 px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none lg:text-base dark:border-blue-600 dark:bg-blue-700 dark:hover:bg-blue-600 dark:focus:ring-offset-gray-800"
							disabled={!stats}
							onclick={() => {
								showMechAssistant = true;
							}}
						>
							Ask Mech
						</button>
						<!-- Dropdown toggle -->
						<button
							class="rounded-r-lg border-l border-blue-500 bg-blue-600 px-2 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none lg:text-base dark:border-blue-600 dark:bg-blue-700 dark:hover:bg-blue-600 dark:focus:ring-offset-gray-800"
							disabled={!stats}
							onclick={() => (showDropdown = !showDropdown)}
							aria-label="Open menu"
							aria-expanded={showDropdown}
							aria-haspopup="true"
						>
							<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
									clip-rule="evenodd"
								/>
							</svg>
						</button>

						<!-- Dropdown menu -->
						{#if showDropdown}
							<div
								class="absolute top-[110%] right-0 z-10 mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
							>
								<div class="">
									<button
										class="flex w-full items-center gap-2 px-6 py-4 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-25 dark:text-gray-300 dark:hover:bg-gray-700"
										disabled={stats?.total_equipment === 0}
										onclick={() => {
											showAddTaskModal = true;
											showDropdown = false;
										}}
									>
										Add Task
									</button>
								</div>
								<div class="">
									<button
										class="flex w-full items-center gap-2 px-6 py-4 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-25 dark:text-gray-300 dark:hover:bg-gray-700"
										disabled={stats?.total_equipment === 0}
										onclick={() => {
											showAddEquipmentModal = true;
											showDropdown = false;
										}}
									>
										Add Equipment
									</button>
								</div>
								<div class="border-t border-gray-100 dark:border-gray-700">
									<a
										href="/api/maintenance-logs/export"
										download
										class="flex w-full items-center gap-2 px-6 py-4 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
										onclick={() => (showDropdown = false)}
									>
										Export maintenance logs (CSV)
									</a>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-7xl">
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
							<div class="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-6 w-6 text-green-600 dark:text-green-400"
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

					<div
						class="rounded-lg bg-white p-4 shadow md:p-6 dark:bg-gray-800 dark:shadow-gray-900/20"
					>
						<div class="flex h-full items-center gap-4">
							<div class="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-6 w-6 text-blue-600 dark:text-blue-400"
									fill="currentColor"
									viewBox="0 0 256 256"
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
							<div class="ml-auto h-full">
								<a
									href="/equipment"
									class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
									aria-label="Edit equipment"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="20"
										height="20"
										fill="currentColor"
										viewBox="0 0 256 256"
										><path
											d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"
										></path></svg
									>
								</a>
							</div>
						</div>
					</div>

					<div
						class="rounded-lg bg-white p-4 shadow md:p-6 dark:bg-gray-800 dark:shadow-gray-900/20"
					>
						<div class="flex h-full items-center gap-4">
							<div class="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-6 w-6 text-purple-600 dark:text-purple-400"
									fill="currentColor"
									viewBox="0 0 256 256"
									><path
										d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"
									></path></svg
								>
							</div>
							<div>
								<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Tasks</p>
								<p class="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_tasks}</p>
							</div>
							<div class="ml-auto h-full">
								<a
									href="/tasks"
									class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
									aria-label="Edit tasks"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="20"
										height="20"
										fill="currentColor"
										viewBox="0 0 256 256"
										><path
											d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"
										></path></svg
									>
								</a>
							</div>
						</div>
					</div>
				</div>
			{/if}

			{#if dueSoonTasks.length > 0}
				<div class="mb-8 rounded-lg bg-white p-4 shadow dark:bg-gray-800 dark:shadow-gray-900/20">
					<h2 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Due this week</h2>
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
									class="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
									onclick={() => openCompleteTaskModal(task)}
								>
									Complete
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if proactiveSuggestions.length > 0}
				<ProactiveSuggestions
					suggestions={proactiveSuggestions}
					onDismiss={() => invalidateAll()}
					onApprove={(action) => {
						mechAssistantInitialPrompt = action;
						showMechAssistant = true;
					}}
				/>
			{/if}

			<!-- View Mode Toggle -->
			<div class="mb-6 flex items-center justify-between">
				<div class="flex items-center gap-3">
					<h2 class="text-xl font-bold text-gray-900 lg:text-2xl dark:text-white">
						Upcoming Tasks
					</h2>
					{#if settings?.upcoming_task_range_days}
						<p class="translate-y-0.5 text-sm text-gray-400">
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
					onCompleteTask={openCompleteTaskModal}
					onAddEquipment={() => (showAddEquipmentModal = true)}
					onAddTask={() => (showAddTaskModal = true)}
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
</div>

<AddEquipmentModal
	isOpen={showAddEquipmentModal}
	{equipmentTypes}
	equipmentCreated={handleEquipmentCreated}
	onCloseModal={() => (showAddEquipmentModal = false)}
/>

<AddTaskModal
	isOpen={showAddTaskModal}
	{equipment}
	{taskTypes}
	{equipmentTypes}
	taskCreated={handleTaskCreated}
	onCloseModal={() => (showAddTaskModal = false)}
/>

<CompleteTaskModal
	isOpen={showCompleteTaskModal}
	task={selectedTask}
	{equipment}
	taskCompleted={handleTaskCompleted}
	onCloseModal={() => (showCompleteTaskModal = false)}
/>

<MechAssistant
	isOpen={showMechAssistant}
	initialPrompt={mechAssistantInitialPrompt}
	onSuccess={() => invalidateAll()}
	onClose={() => {
		mechAssistantInitialPrompt = undefined;
		showMechAssistant = false;
	}}
/>
