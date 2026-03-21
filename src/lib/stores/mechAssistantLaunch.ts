import { writable } from 'svelte/store';

/** Opens MechAssistant from outside AppMechChrome (e.g. proactive suggestions). */
export const mechAssistantLaunch = writable<{ prompt?: string } | null>(null);

/** Opens Add Equipment modal from dashboard list empty state. */
export const requestOpenAddEquipmentModal = writable(false);

/** Opens Add Task modal from dashboard list empty state. */
export const requestOpenAddTaskModal = writable(false);
