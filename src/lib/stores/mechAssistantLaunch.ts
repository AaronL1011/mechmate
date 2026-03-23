import { writable } from 'svelte/store';

/** Opens MechAssistant from outside AppMechChrome (e.g. proactive suggestions). */
export const mechAssistantLaunch = writable<{ prompt?: string } | null>(null);

/** When set, agent chat requests include this equipment as focus (resources + context). Cleared when leaving equipment sub-pages. */
export const mechAssistantEquipmentFocus = writable<number | null>(null);

/** Opens Add Equipment modal from dashboard list empty state. */
export const requestOpenAddEquipmentModal = writable(false);

/** Opens Add Task modal from dashboard list empty state. */
export const requestOpenAddTaskModal = writable(false);
