<script lang="ts">
	import { onMount } from 'svelte';
	import type { AppShell } from '$lib/types/appShell';
	import {
		requestOpenAddEquipmentModal,
		requestOpenAddTaskModal
	} from '$lib/stores/mechAssistantLaunch';

	let { shell }: { shell: AppShell } = $props();

	let showDropdown = $state(false);

	const stats = $derived(shell.stats);

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.quick-actions-menu')) {
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

<header
	class="mb-4 max-w-7xl rounded-lg border-gray-200 bg-white shadow-sm lg:mx-auto dark:border-gray-700 dark:bg-gray-800"
>
	<div class="px-4 sm:px-6 lg:px-8">
		<div class="flex items-center justify-between space-x-4 py-4">
			<a
				href="/"
				class="flex items-center gap-4 rounded-md ring-blue-500 outline-none focus-visible:ring-2"
				aria-label="Mechmate home"
			>
				<img src="/robot.png" alt="" class="h-10 w-10" />
				<span class="text-xl font-bold text-gray-900 lg:text-2xl dark:text-white">Mechmate</span>
			</a>
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

				<div class="quick-actions-menu relative inline-flex rounded-lg shadow-sm">
					<button
						type="button"
						class="rounded-lg border border-gray-200 bg-white p-2.5 text-gray-700 transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:focus-visible:ring-offset-gray-800"
						disabled={!stats}
						onclick={() => (showDropdown = !showDropdown)}
						aria-label="Quick actions"
						aria-expanded={showDropdown}
						aria-haspopup="true"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="22"
							height="22"
							fill="currentColor"
							viewBox="0 0 256 256"
							aria-hidden="true"
						>
							<path
								d="M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128Zm56,0a12,12,0,1,1-12-12A12,12,0,0,1,196,128ZM84,128a12,12,0,1,1-12-12A12,12,0,0,1,84,128Z"
							></path>
						</svg>
					</button>

					{#if showDropdown}
						<div
							class="absolute top-[110%] right-0 z-10 mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
						>
							<div class="">
								<button
									type="button"
									class="flex w-full items-center gap-2 px-6 py-4 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-25 dark:text-gray-300 dark:hover:bg-gray-700"
									disabled={stats?.total_equipment === 0}
									onclick={() => {
										requestOpenAddTaskModal.set(true);
										showDropdown = false;
									}}
								>
									Add Task
								</button>
							</div>
							<div class="">
								<button
									type="button"
									class="flex w-full items-center gap-2 px-6 py-4 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-25 dark:text-gray-300 dark:hover:bg-gray-700"
									disabled={stats?.total_equipment === 0}
									onclick={() => {
										requestOpenAddEquipmentModal.set(true);
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
