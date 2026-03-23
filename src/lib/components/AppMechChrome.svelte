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
		class="group fixed end-[calc(1.5rem+env(safe-area-inset-right,0px))] bottom-[calc(2rem+env(safe-area-inset-bottom,0px))] z-40 inline-flex items-center justify-center rounded-full border-0 bg-transparent p-0 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 lg:end-[calc(1.5rem+env(safe-area-inset-right,0px))] lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] dark:focus-visible:ring-offset-gray-900"
		disabled={!stats}
		aria-label="Open Mech assistant"
		onclick={() => {
			showMechAssistant = true;
		}}
	>
		<span
			class="cursor-pointer mech-fab-surface relative inline-flex min-h-20 min-w-20 items-center justify-center gap-3 rounded-full bg-white/10 px-3 py-3 text-gray-800 shadow-sm backdrop-blur-lg backdrop-saturate-150 transition-[background-color,border-color,transform] duration-300 sm:gap-4 sm:px-8 dark:bg-gray-600/10 dark:text-gray-100 dark:backdrop-blur-lg group-hover:bg-white/55 group-active:scale-[0.98] dark:group-hover:bg-gray-400/10"
		>
			<img
				src="/robot.png"
				alt=""
				class="mech-fab-icon h-10 w-10 shrink-0 sm:h-10 sm:w-10"
			/>
			<span class="hidden text-lg font-semibold tracking-tight sm:inline">Ask Mech</span>
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
	.mech-fab-surface {
		border: 1px solid rgba(191, 219, 254, 0.38);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.55),
			0 0 0 1px rgba(59, 130, 246, 0.07),
			0 0 8px 0 rgba(37, 99, 235, 0.3),
			0 0 14px 1px rgba(34, 211, 238, 0.1),
			0 0 20px 2px rgba(147, 197, 253, 0.16);
		animation: mech-fab-glow-light 5.5s ease-in-out infinite;
	}

	.group:hover:not(:disabled) .mech-fab-surface {
		border-color: rgba(224, 242, 254, 0.55);
	}

	@media (prefers-color-scheme: dark) {
		.mech-fab-surface {
			border: 1px solid rgba(125, 211, 252, 0.16);
			box-shadow:
				inset 0 1px 0 rgba(255, 255, 255, 0.1),
				0 0 0 1px rgba(96, 165, 250, 0.12),
				0 0 10px 1px rgba(59, 130, 246, 0.4),
				0 0 18px 2px rgba(34, 211, 238, 0.11),
				0 0 24px 2px rgba(96, 165, 250, 0.1);
			animation: mech-fab-glow-dark 5.5s ease-in-out infinite;
		}

		.group:hover:not(:disabled) .mech-fab-surface {
			border-color: rgba(125, 211, 252, 0.28);
		}
	}

	.mech-fab-icon {
		filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.12));
	}

	button:disabled .mech-fab-surface {
		animation: none;
		border-color: rgba(148, 163, 184, 0.32);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.28),
			0 0 0 1px rgba(148, 163, 184, 0.15),
			0 0 6px rgba(15, 23, 42, 0.06);
	}

	@media (prefers-color-scheme: dark) {
		.mech-fab-icon {
			filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45));
		}

		button:disabled .mech-fab-surface {
			border-color: rgba(71, 85, 105, 0.4);
			box-shadow:
				inset 0 1px 0 rgba(255, 255, 255, 0.04),
				0 0 0 1px rgba(15, 23, 42, 0.6),
				0 0 8px rgba(0, 0, 0, 0.38);
		}
	}

	@keyframes mech-fab-glow-light {
		0%,
		100% {
			box-shadow:
				inset 0 1px 0 rgba(255, 255, 255, 0.55),
				0 0 0 1px rgba(59, 130, 246, 0.07),
				0 0 8px 0 rgba(37, 99, 235, 0.3),
				0 0 14px 1px rgba(34, 211, 238, 0.1),
				0 0 20px 2px rgba(147, 197, 253, 0.16);
		}
		50% {
			box-shadow:
				inset 0 1px 0 rgba(255, 255, 255, 0.62),
				0 0 0 1px rgba(34, 211, 238, 0.09),
				0 0 11px 0 rgba(34, 211, 238, 0.22),
				0 0 17px 2px rgba(59, 130, 246, 0.14),
				0 0 24px 2px rgba(96, 165, 250, 0.2);
		}
	}

	@keyframes mech-fab-glow-dark {
		0%,
		100% {
			box-shadow:
				inset 0 1px 0 rgba(255, 255, 255, 0.1),
				0 0 0 1px rgba(96, 165, 250, 0.12),
				0 0 10px 1px rgba(59, 130, 246, 0.4),
				0 0 18px 2px rgba(34, 211, 238, 0.11),
				0 0 24px 2px rgba(96, 165, 250, 0.1);
		}
		50% {
			box-shadow:
				inset 0 1px 0 rgba(255, 255, 255, 0.14),
				0 0 0 1px rgba(34, 211, 238, 0.13),
				0 0 12px 1px rgba(34, 211, 238, 0.28),
				0 0 20px 2px rgba(147, 197, 253, 0.09),
				0 0 28px 3px rgba(59, 130, 246, 0.24);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.mech-fab-surface {
			animation: none;
		}

		@media (prefers-color-scheme: dark) {
			.mech-fab-surface {
				box-shadow:
					inset 0 1px 0 rgba(255, 255, 255, 0.1),
					0 0 0 1px rgba(96, 165, 250, 0.12),
					0 0 10px 1px rgba(59, 130, 246, 0.38),
					0 0 18px 2px rgba(34, 211, 238, 0.11),
					0 0 24px 2px rgba(96, 165, 250, 0.1);
			}
		}
	}
</style>
