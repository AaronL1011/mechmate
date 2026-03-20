<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import AppHeader from '$lib/components/AppHeader.svelte';

	let { data, children } = $props();

	function isEquipmentLabelPath(pathname: string): boolean {
		return /^\/equipment\/[^/]+\/label\/?$/.test(pathname);
	}
</script>

{#if isEquipmentLabelPath($page.url.pathname)}
	{@render children()}
{:else}
	<div class="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8 dark:bg-gray-900">
		<AppHeader shell={data.shell} />
		{@render children()}
	</div>
{/if}
