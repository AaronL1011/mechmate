<script lang="ts">
	import { onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { mechAssistantEquipmentFocus } from '$lib/stores/mechAssistantLaunch';

	let { children } = $props();

	$effect(() => {
		const raw = $page.params.id;
		const n = raw ? Number(raw) : NaN;
		if (!Number.isNaN(n)) mechAssistantEquipmentFocus.set(n);
	});

	onDestroy(() => {
		mechAssistantEquipmentFocus.set(null);
	});
</script>

{@render children()}
