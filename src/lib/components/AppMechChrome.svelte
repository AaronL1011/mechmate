<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import type { AppShell } from '$lib/types/appShell';
	import type { Equipment, Task } from '$lib/types/db.js';
	import AddEquipmentModal from '$lib/components/AddEquipmentModal.svelte';
	import AddTaskModal from '$lib/components/AddTaskModal.svelte';
	import MechAssistant from '$lib/components/MechAssistant.svelte';
	import {
		mechAssistantLaunch,
		requestOpenAddEquipmentModal,
		requestOpenAddTaskModal
	} from '$lib/stores/mechAssistantLaunch';

	let { shell }: { shell: AppShell } = $props();

	let showMechAssistant = $state(false);
	let mechAssistantInitialPrompt = $state<string | undefined>(undefined);
	let showAddEquipmentModal = $state(false);
	let showAddTaskModal = $state(false);

	const stats = $derived(shell.stats);

	onMount(() => {
		const unsubMech = mechAssistantLaunch.subscribe((payload) => {
			if (payload) {
				mechAssistantInitialPrompt = payload.prompt;
				showMechAssistant = true;
				mechAssistantLaunch.set(null);
			}
		});
		const unsubEq = requestOpenAddEquipmentModal.subscribe((open) => {
			if (open) {
				showAddEquipmentModal = true;
				requestOpenAddEquipmentModal.set(false);
			}
		});
		const unsubTask = requestOpenAddTaskModal.subscribe((open) => {
			if (open) {
				showAddTaskModal = true;
				requestOpenAddTaskModal.set(false);
			}
		});

		return () => {
			unsubMech();
			unsubEq();
			unsubTask();
		};
	});

	function handleEquipmentCreated(_equipment: Equipment) {
		invalidateAll();
	}

	function handleTaskCreated(_task: Task) {
		invalidateAll();
	}
</script>

{#if !showMechAssistant}
	<button
		type="button"
		class="group fixed end-[calc(1.5rem+env(safe-area-inset-right,0px))] bottom-[calc(2rem+env(safe-area-inset-bottom,0px))] z-40 inline-flex min-h-20 min-w-20 items-center justify-center rounded-full p-[3px] text-sm font-semibold text-white focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 lg:end-[calc(1.5rem+env(safe-area-inset-right,0px))] lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] dark:focus-visible:ring-offset-gray-900"
		disabled={!stats}
		aria-label="Open Mech assistant"
		onclick={() => {
			showMechAssistant = true;
		}}
	>
		<span class="mech-fab-ring pointer-events-none absolute inset-0 rounded-full" aria-hidden="true"
		></span>
		<span
			class="relative z-[1] inline-flex min-h-20 min-w-20 items-center justify-center gap-4 rounded-full bg-gradient-to-b from-blue-500 to-blue-600 px-3 py-3 text-white shadow-md ring-1 ring-white/25 transition-[box-shadow,filter] duration-200 ring-inset group-hover:shadow-lg group-hover:shadow-blue-500/35 group-hover:brightness-[1.05] group-focus-visible:shadow-lg group-focus-visible:shadow-blue-500/40 group-disabled:from-gray-500 group-disabled:to-gray-600 group-disabled:shadow-none sm:px-4 dark:from-blue-500 dark:to-blue-700 dark:ring-white/15 dark:group-hover:shadow-blue-400/30 dark:group-hover:brightness-110"
		>
			<img src="/robot.png" alt="" class="h-10 w-10 shrink-0 drop-shadow-sm sm:h-10 sm:w-10 opacity-80 mix-blend-luminosity" />
			<span class="hidden sm:inline text-lg">Ask Mech</span>
		</span>
	</button>
{/if}

<AddEquipmentModal
	isOpen={showAddEquipmentModal}
	equipmentTypes={shell.equipmentTypes}
	equipmentCreated={handleEquipmentCreated}
	onCloseModal={() => (showAddEquipmentModal = false)}
/>

<AddTaskModal
	isOpen={showAddTaskModal}
	equipment={shell.equipment}
	taskTypes={shell.taskTypes}
	equipmentTypes={shell.equipmentTypes}
	taskCreated={handleTaskCreated}
	onCloseModal={() => (showAddTaskModal = false)}
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

<style>
	/*
	 * Animate the conic gradient angle, not transform — rotating the whole pill
	 * makes the masked border spin off-axis behind the button.
	 */
	@property --mech-fab-angle {
		syntax: '<angle>';
		initial-value: 0deg;
		inherits: false;
	}

	/* Conic gradient only in a ~3px band (not the full pill fill). */
	.mech-fab-ring {
		--mech-fab-angle: 0deg;
		box-sizing: border-box;
		padding: 3px;
		background: conic-gradient(
			from var(--mech-fab-angle),
			rgb(59, 130, 246),
			rgb(34, 211, 238),
			rgb(147, 197, 253),
			rgb(59, 130, 246)
		);
		-webkit-mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		-webkit-mask-composite: xor;
		mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		mask-composite: exclude;
		animation: mech-fab-ring-angle 3.2s linear infinite;
	}

	button:disabled .mech-fab-ring {
		animation: none;
		opacity: 0;
	}

	@keyframes mech-fab-ring-angle {
		to {
			--mech-fab-angle: 360deg;
		}
	}

	@keyframes mech-fab-ring-soft-pulse {
		0%,
		100% {
			opacity: 0.65;
		}
		50% {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.mech-fab-ring {
			animation: mech-fab-ring-soft-pulse 2s ease-in-out infinite;
		}

		button:disabled .mech-fab-ring {
			animation: none;
			opacity: 0;
		}
	}
</style>
