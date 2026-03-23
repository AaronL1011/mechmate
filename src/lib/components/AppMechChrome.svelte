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
			class="cursor-pointer mech-fab-surface relative inline-flex min-h-20 min-w-20 items-center justify-center gap-3 rounded-full bg-white/10 px-3 py-3 text-gray-800 shadow-sm backdrop-blur-sm backdrop-saturate-150 transition-[background-color,border-color,transform] duration-300 sm:gap-4 sm:px-8 dark:bg-gray-600/10 dark:text-gray-100 dark:backdrop-blur-sm group-hover:bg-white/55 group-active:scale-[0.98] dark:group-hover:bg-gray-400/10"
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
	/*
	 * FAB glow handles — all on .mech-fab-surface (dark theme overrides a few below).
	 * duration / easing: animation feel
	 * strength: multiplies ring + outer glow alphas (not border / inset)
	 * inset-strength: multiplies top inset highlight alpha
	 * offset-scale: multiplies outer-glow x/y offsets (not the 1px ring)
	 * blur-scale: multiplies outer-glow blur radius only
	 * spread-scale: multiplies outer-glow spread only
	 * border-alpha: static border opacity (light); dark block sets its own
	 * border-hover-alpha: hover border (light / dark in respective blocks)
	 *
	 * Glow hues cycle by keyframe: blue + teal + indigo-200 (rest); indigo ring +
	 * violet outer (25%); teal ring + teal + indigo + fuchsia outer (50%); sky ring +
	 * sky + emerald + violet-600 (75%). Dark mode mirrors with slightly brighter stops.
	 */
	.mech-fab-surface {
		--mech-fab-glow-duration: 6.5s;
		--mech-fab-glow-easing: ease-in-out;
		--mech-fab-glow-strength: 1;
		--mech-fab-glow-inset-strength: 1;
		--mech-fab-glow-offset-scale: 1.5;
		--mech-fab-glow-blur-scale: 0.1;
		--mech-fab-glow-spread-scale: 0;
		--mech-fab-glow-border-alpha: 1;
		--mech-fab-glow-border-hover-alpha: 0;

		border: 1px solid rgb(191 219 254 / var(--mech-fab-glow-border-alpha));
		box-shadow:
			inset 0 1px 0 rgb(255 255 255 / calc(0.55 * var(--mech-fab-glow-inset-strength))),
			0 0 0 1px rgb(59 130 246 / calc(0.07 * var(--mech-fab-glow-strength))),
			calc(3px * var(--mech-fab-glow-offset-scale)) calc(-1px * var(--mech-fab-glow-offset-scale))
				calc(8px * var(--mech-fab-glow-blur-scale)) 0
				rgb(37 99 235 / calc(0.3 * var(--mech-fab-glow-strength))),
			calc(-2px * var(--mech-fab-glow-offset-scale)) calc(1px * var(--mech-fab-glow-offset-scale))
				calc(14px * var(--mech-fab-glow-blur-scale)) calc(1px * var(--mech-fab-glow-spread-scale))
				rgb(20 184 166 / calc(0.12 * var(--mech-fab-glow-strength))),
			calc(1px * var(--mech-fab-glow-offset-scale)) calc(2px * var(--mech-fab-glow-offset-scale))
				calc(20px * var(--mech-fab-glow-blur-scale)) calc(2px * var(--mech-fab-glow-spread-scale))
				rgb(165 180 252 / calc(0.18 * var(--mech-fab-glow-strength)));
		animation: mech-fab-glow-light var(--mech-fab-glow-duration) var(--mech-fab-glow-easing) infinite;
	}

	.group:hover:not(:disabled) .mech-fab-surface {
		border-color: rgb(224 242 254 / var(--mech-fab-glow-border-hover-alpha));
	}

	@media (prefers-color-scheme: dark) {
		.mech-fab-surface {
			--mech-fab-glow-border-alpha: 0.16;
			--mech-fab-glow-border-hover-alpha: 0.28;

			border: 1px solid rgb(125 211 252 / var(--mech-fab-glow-border-alpha));
			box-shadow:
				inset 0 1px 0 rgb(255 255 255 / calc(0.1 * var(--mech-fab-glow-inset-strength))),
				0 0 0 1px rgb(96 165 250 / calc(0.12 * var(--mech-fab-glow-strength))),
				calc(2px * var(--mech-fab-glow-offset-scale)) calc(-2px * var(--mech-fab-glow-offset-scale))
					calc(10px * var(--mech-fab-glow-blur-scale)) calc(1px * var(--mech-fab-glow-spread-scale))
					rgb(59 130 246 / calc(0.4 * var(--mech-fab-glow-strength))),
				calc(-2px * var(--mech-fab-glow-offset-scale)) calc(1px * var(--mech-fab-glow-offset-scale))
					calc(18px * var(--mech-fab-glow-blur-scale)) calc(2px * var(--mech-fab-glow-spread-scale))
					rgb(45 212 191 / calc(0.14 * var(--mech-fab-glow-strength))),
				calc(1px * var(--mech-fab-glow-offset-scale)) calc(2px * var(--mech-fab-glow-offset-scale))
					calc(24px * var(--mech-fab-glow-blur-scale)) calc(2px * var(--mech-fab-glow-spread-scale))
					rgb(167 139 250 / calc(0.14 * var(--mech-fab-glow-strength)));
			animation: mech-fab-glow-dark var(--mech-fab-glow-duration) var(--mech-fab-glow-easing) infinite;
		}

		.group:hover:not(:disabled) .mech-fab-surface {
			border-color: rgb(125 211 252 / var(--mech-fab-glow-border-hover-alpha));
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
				inset 0 1px 0 rgb(255 255 255 / calc(0.55 * var(--mech-fab-glow-inset-strength))),
				0 0 0 1px rgb(59 130 246 / calc(0.07 * var(--mech-fab-glow-strength))),
				calc(3px * var(--mech-fab-glow-offset-scale)) calc(-1px * var(--mech-fab-glow-offset-scale))
					calc(8px * var(--mech-fab-glow-blur-scale)) 0
					rgb(37 99 235 / calc(0.3 * var(--mech-fab-glow-strength))),
				calc(-2px * var(--mech-fab-glow-offset-scale)) calc(1px * var(--mech-fab-glow-offset-scale))
					calc(14px * var(--mech-fab-glow-blur-scale)) calc(1px * var(--mech-fab-glow-spread-scale))
					rgb(20 184 166 / calc(0.12 * var(--mech-fab-glow-strength))),
				calc(1px * var(--mech-fab-glow-offset-scale)) calc(2px * var(--mech-fab-glow-offset-scale))
					calc(20px * var(--mech-fab-glow-blur-scale)) calc(2px * var(--mech-fab-glow-spread-scale))
					rgb(165 180 252 / calc(0.18 * var(--mech-fab-glow-strength)));
		}
		25% {
			box-shadow:
				inset 0 1px 0 rgb(255 255 255 / calc(0.58 * var(--mech-fab-glow-inset-strength))),
				0 0 0 1px rgb(99 102 241 / calc(0.1 * var(--mech-fab-glow-strength))),
				0 calc(3px * var(--mech-fab-glow-offset-scale)) calc(10px * var(--mech-fab-glow-blur-scale)) 0
					rgb(79 70 229 / calc(0.3 * var(--mech-fab-glow-strength))),
				calc(2px * var(--mech-fab-glow-offset-scale)) calc(-2px * var(--mech-fab-glow-offset-scale))
					calc(15px * var(--mech-fab-glow-blur-scale)) calc(1px * var(--mech-fab-glow-spread-scale))
					rgb(34 211 238 / calc(0.15 * var(--mech-fab-glow-strength))),
				calc(-2px * var(--mech-fab-glow-offset-scale)) 0
					calc(21px * var(--mech-fab-glow-blur-scale)) calc(2px * var(--mech-fab-glow-spread-scale))
					rgb(192 132 252 / calc(0.2 * var(--mech-fab-glow-strength)));
		}
		50% {
			box-shadow:
				inset 0 1px 0 rgb(255 255 255 / calc(0.68 * var(--mech-fab-glow-inset-strength))),
				0 0 0 1px rgb(45 212 191 / calc(0.14 * var(--mech-fab-glow-strength))),
				calc(-3px * var(--mech-fab-glow-offset-scale)) calc(2px * var(--mech-fab-glow-offset-scale))
					calc(15px * var(--mech-fab-glow-blur-scale)) calc(1px * var(--mech-fab-glow-spread-scale))
					rgb(13 148 136 / calc(0.38 * var(--mech-fab-glow-strength))),
				calc(2px * var(--mech-fab-glow-offset-scale)) calc(1px * var(--mech-fab-glow-offset-scale))
					calc(24px * var(--mech-fab-glow-blur-scale)) calc(3px * var(--mech-fab-glow-spread-scale))
					rgb(99 102 241 / calc(0.24 * var(--mech-fab-glow-strength))),
				calc(1px * var(--mech-fab-glow-offset-scale)) calc(-3px * var(--mech-fab-glow-offset-scale))
					calc(34px * var(--mech-fab-glow-blur-scale)) calc(4px * var(--mech-fab-glow-spread-scale))
					rgb(217 70 239 / calc(0.22 * var(--mech-fab-glow-strength)));
		}
		75% {
			box-shadow:
				inset 0 1px 0 rgb(255 255 255 / calc(0.58 * var(--mech-fab-glow-inset-strength))),
				0 0 0 1px rgb(14 165 233 / calc(0.09 * var(--mech-fab-glow-strength))),
				calc(1px * var(--mech-fab-glow-offset-scale)) calc(-2px * var(--mech-fab-glow-offset-scale))
					calc(10px * var(--mech-fab-glow-blur-scale)) 0
					rgb(2 132 199 / calc(0.3 * var(--mech-fab-glow-strength))),
				calc(-3px * var(--mech-fab-glow-offset-scale)) calc(1px * var(--mech-fab-glow-offset-scale))
					calc(15px * var(--mech-fab-glow-blur-scale)) calc(1px * var(--mech-fab-glow-spread-scale))
					rgb(52 211 153 / calc(0.13 * var(--mech-fab-glow-strength))),
				calc(2px * var(--mech-fab-glow-offset-scale)) calc(2px * var(--mech-fab-glow-offset-scale))
					calc(21px * var(--mech-fab-glow-blur-scale)) calc(2px * var(--mech-fab-glow-spread-scale))
					rgb(147 51 234 / calc(0.17 * var(--mech-fab-glow-strength)));
		}
	}

	@keyframes mech-fab-glow-dark {
		0%,
		100% {
			box-shadow:
				inset 0 1px 0 rgb(255 255 255 / calc(0.1 * var(--mech-fab-glow-inset-strength))),
				0 0 0 1px rgb(96 165 250 / calc(0.12 * var(--mech-fab-glow-strength))),
				calc(2px * var(--mech-fab-glow-offset-scale)) calc(-2px * var(--mech-fab-glow-offset-scale))
					calc(10px * var(--mech-fab-glow-blur-scale)) calc(1px * var(--mech-fab-glow-spread-scale))
					rgb(59 130 246 / calc(0.4 * var(--mech-fab-glow-strength))),
				calc(-2px * var(--mech-fab-glow-offset-scale)) calc(1px * var(--mech-fab-glow-offset-scale))
					calc(18px * var(--mech-fab-glow-blur-scale)) calc(2px * var(--mech-fab-glow-spread-scale))
					rgb(45 212 191 / calc(0.14 * var(--mech-fab-glow-strength))),
				calc(1px * var(--mech-fab-glow-offset-scale)) calc(2px * var(--mech-fab-glow-offset-scale))
					calc(24px * var(--mech-fab-glow-blur-scale)) calc(2px * var(--mech-fab-glow-spread-scale))
					rgb(167 139 250 / calc(0.14 * var(--mech-fab-glow-strength)));
		}
		25% {
			box-shadow:
				inset 0 1px 0 rgb(255 255 255 / calc(0.12 * var(--mech-fab-glow-inset-strength))),
				0 0 0 1px rgb(129 140 248 / calc(0.16 * var(--mech-fab-glow-strength))),
				0 calc(3px * var(--mech-fab-glow-offset-scale)) calc(12px * var(--mech-fab-glow-blur-scale))
					calc(1px * var(--mech-fab-glow-spread-scale))
					rgb(99 102 241 / calc(0.38 * var(--mech-fab-glow-strength))),
				calc(2px * var(--mech-fab-glow-offset-scale)) calc(-2px * var(--mech-fab-glow-offset-scale))
					calc(19px * var(--mech-fab-glow-blur-scale)) calc(2px * var(--mech-fab-glow-spread-scale))
					rgb(34 211 238 / calc(0.15 * var(--mech-fab-glow-strength))),
				calc(-2px * var(--mech-fab-glow-offset-scale)) 0
					calc(25px * var(--mech-fab-glow-blur-scale)) calc(2px * var(--mech-fab-glow-spread-scale))
					rgb(192 132 252 / calc(0.16 * var(--mech-fab-glow-strength)));
		}
		50% {
			box-shadow:
				inset 0 1px 0 rgb(255 255 255 / calc(0.2 * var(--mech-fab-glow-inset-strength))),
				0 0 0 1px rgb(45 212 191 / calc(0.22 * var(--mech-fab-glow-strength))),
				calc(-3px * var(--mech-fab-glow-offset-scale)) calc(2px * var(--mech-fab-glow-offset-scale))
					calc(16px * var(--mech-fab-glow-blur-scale)) calc(2px * var(--mech-fab-glow-spread-scale))
					rgb(20 184 166 / calc(0.44 * var(--mech-fab-glow-strength))),
				calc(2px * var(--mech-fab-glow-offset-scale)) calc(1px * var(--mech-fab-glow-offset-scale))
					calc(26px * var(--mech-fab-glow-blur-scale)) calc(4px * var(--mech-fab-glow-spread-scale))
					rgb(129 140 248 / calc(0.2 * var(--mech-fab-glow-strength))),
				calc(1px * var(--mech-fab-glow-offset-scale)) calc(-3px * var(--mech-fab-glow-offset-scale))
					calc(36px * var(--mech-fab-glow-blur-scale)) calc(4px * var(--mech-fab-glow-spread-scale))
					rgb(217 70 239 / calc(0.26 * var(--mech-fab-glow-strength)));
		}
		75% {
			box-shadow:
				inset 0 1px 0 rgb(255 255 255 / calc(0.12 * var(--mech-fab-glow-inset-strength))),
				0 0 0 1px rgb(56 189 248 / calc(0.15 * var(--mech-fab-glow-strength))),
				calc(1px * var(--mech-fab-glow-offset-scale)) calc(-2px * var(--mech-fab-glow-offset-scale))
					calc(12px * var(--mech-fab-glow-blur-scale)) calc(1px * var(--mech-fab-glow-spread-scale))
					rgb(14 165 233 / calc(0.38 * var(--mech-fab-glow-strength))),
				calc(-3px * var(--mech-fab-glow-offset-scale)) calc(1px * var(--mech-fab-glow-offset-scale))
					calc(19px * var(--mech-fab-glow-blur-scale)) calc(2px * var(--mech-fab-glow-spread-scale))
					rgb(52 211 153 / calc(0.14 * var(--mech-fab-glow-strength))),
				calc(2px * var(--mech-fab-glow-offset-scale)) calc(2px * var(--mech-fab-glow-offset-scale))
					calc(25px * var(--mech-fab-glow-blur-scale)) calc(2px * var(--mech-fab-glow-spread-scale))
					rgb(168 85 247 / calc(0.15 * var(--mech-fab-glow-strength)));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.mech-fab-surface {
			animation: none;
			box-shadow:
				inset 0 1px 0 rgb(255 255 255 / calc(0.55 * var(--mech-fab-glow-inset-strength))),
				0 0 0 1px rgb(59 130 246 / calc(0.07 * var(--mech-fab-glow-strength))),
				0 0 calc(8px * var(--mech-fab-glow-blur-scale)) 0
					rgb(37 99 235 / calc(0.3 * var(--mech-fab-glow-strength))),
				0 0 calc(14px * var(--mech-fab-glow-blur-scale))
					calc(1px * var(--mech-fab-glow-spread-scale))
					rgb(20 184 166 / calc(0.12 * var(--mech-fab-glow-strength))),
				0 0 calc(20px * var(--mech-fab-glow-blur-scale))
					calc(2px * var(--mech-fab-glow-spread-scale))
					rgb(165 180 252 / calc(0.18 * var(--mech-fab-glow-strength)));
		}

		@media (prefers-color-scheme: dark) {
			.mech-fab-surface {
				box-shadow:
					inset 0 1px 0 rgb(255 255 255 / calc(0.1 * var(--mech-fab-glow-inset-strength))),
					0 0 0 1px rgb(96 165 250 / calc(0.12 * var(--mech-fab-glow-strength))),
					0 0 calc(10px * var(--mech-fab-glow-blur-scale))
						calc(1px * var(--mech-fab-glow-spread-scale))
						rgb(59 130 246 / calc(0.38 * var(--mech-fab-glow-strength))),
					0 0 calc(18px * var(--mech-fab-glow-blur-scale))
						calc(2px * var(--mech-fab-glow-spread-scale))
						rgb(45 212 191 / calc(0.14 * var(--mech-fab-glow-strength))),
					0 0 calc(24px * var(--mech-fab-glow-blur-scale))
						calc(2px * var(--mech-fab-glow-spread-scale))
						rgb(167 139 250 / calc(0.14 * var(--mech-fab-glow-strength)));
			}
		}
	}
</style>
