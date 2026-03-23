<script lang="ts">
	let {
		equipmentId,
		equipmentName,
		current
	}: {
		equipmentId: string;
		equipmentName: string;
		current: 'history' | 'resources';
	} = $props();

	const tabs = $derived([
		{
			href: `/equipment/${equipmentId}/history`,
			label: 'Service history',
			key: 'history' as const
		},
		{ href: `/equipment/${equipmentId}/resources`, label: 'Resources', key: 'resources' as const }
	]);
</script>

<header class="mx-auto my-8 max-w-7xl pl-4">
	<div class="mb-4 flex items-center gap-4">
		<a
			href="/equipment"
			class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
			aria-label="Back to equipment list"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				fill="currentColor"
				viewBox="0 0 256 256"
			>
				<path
					d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"
				></path>
			</svg>
		</a>
		<div class="min-w-0 flex-1">
			<h1 class="truncate text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">
				{equipmentName}
			</h1>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
				{current === 'history' ? 'Service history & details' : 'Knowledge base & documents'}
			</p>
		</div>
	</div>
	<nav
		class="flex gap-1 border-b border-gray-200 dark:border-gray-700"
		aria-label="Equipment sections"
	>
		{#each tabs as tab (tab.key)}
			<a
				href={tab.href}
				class="relative -mb-px rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors {current ===
				tab.key
					? 'border-b-2 border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300'
					: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'}"
			>
				{tab.label}
			</a>
		{/each}
	</nav>
</header>
