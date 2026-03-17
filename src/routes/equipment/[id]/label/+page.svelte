<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let equipmentName = $state('');
	let error = $state('');

	const equipmentId = $derived($page.params.id);

	const labelUrl = $derived(
		typeof window !== 'undefined' ? `${window.location.origin}/equipment/${equipmentId}/history` : ''
	);
	const qrSrc = $derived(
		labelUrl
			? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(labelUrl)}`
			: ''
	);

	onMount(async () => {
		try {
			const res = await fetch(`/api/equipment/${equipmentId}`);
			if (!res.ok) throw new Error('Not found');
			const data = await res.json();
			equipmentName = data.name || 'Equipment';
		} catch {
			error = 'Equipment not found';
		}
	});
</script>

<svelte:head>
	<title>Label - {equipmentName || 'Equipment'}</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-white p-8 print:bg-white">
	{#if error}
		<p class="text-red-600">{error}</p>
	{:else}
		<h1 class="mb-4 text-2xl font-bold text-gray-900">{equipmentName}</h1>
		{#if qrSrc}
			<img src={qrSrc} alt="QR code" width="200" height="200" class="border border-gray-200" />
		{/if}
		<p class="mt-4 text-sm text-gray-500">Scan to open equipment</p>
		<a href="/equipment/{equipmentId}/history" class="mt-2 text-blue-600 hover:underline"
			>/equipment/{equipmentId}/history</a
		>
	{/if}
</div>
