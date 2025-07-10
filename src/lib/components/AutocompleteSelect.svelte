<script lang="ts">
	// Svelte 5 Runes syntax – all external interactions come through $props()
	type Option = { id: number; name: string };
	let {
		options = [],
		value = $bindable(),
		onCreate = async () => {}
	}: {
		options: Option[];
		value?: number;
		onCreate: (label: string) => Promise<void>;
	} = $props();

	// Local state (search text + dropdown visibility)
	let search = $state('');
	let open = $state(false);
	let focusedIndex = $state(-1);
	let inputId = `input-${Math.random().toString(36).substr(2, 9)}`;
	let listboxId = `listbox-${Math.random().toString(36).substr(2, 9)}`;
	let loading = $state(false);

	// Keep the search box in sync with the bound value
	$effect(() => {
		if (value != null) {
			const match = options.find((o) => o.id === value);
			if (match) search = match.name;
		}
	});

	// Filter options by the current search query (case-insensitive)
	let filtered = $derived(
		search ? options.filter((o) => o.name.toLowerCase().includes(search.toLowerCase())) : options
	);

	// Reset focused index when filtered options change
	$effect(() => {
		if (filtered.length > 0) {
			focusedIndex = Math.min(focusedIndex, filtered.length - 1);
		} else {
			focusedIndex = -1;
		}
	});

	function selectOption(opt: Option) {
		value = opt.id;
		search = opt.name;
		open = false;
		focusedIndex = -1;
	}

	async function attemptCreate() {
		loading = true;
		const label = search.trim();
		if (!label) return;
		await onCreate(label);
		loading = false;
		open = false;
		focusedIndex = -1;
	}

	function handleInput(evt: any) {
		search = evt.target.value;
		open = true;
		focusedIndex = -1;
	}

	function handleKeydown(evt: KeyboardEvent) {
		if (!open) {
			if (evt.key === 'ArrowDown' || evt.key === 'Enter') {
				evt.preventDefault();
				open = true;
				focusedIndex = 0;
			}
			return;
		}

		switch (evt.key) {
			case 'ArrowDown':
				evt.preventDefault();
				if (filtered.length > 0) {
					focusedIndex = (focusedIndex + 1) % filtered.length;
				}
				break;
			case 'ArrowUp':
				evt.preventDefault();
				if (filtered.length > 0) {
					focusedIndex = focusedIndex <= 0 ? filtered.length - 1 : focusedIndex - 1;
				}
				break;
			case 'Enter':
				evt.preventDefault();
				if (focusedIndex >= 0 && focusedIndex < filtered.length) {
					selectOption(filtered[focusedIndex]);
				} else if (search.trim()) {
					attemptCreate();
				}
				break;
			case 'Escape':
				evt.preventDefault();
				open = false;
				focusedIndex = -1;
				break;
			case 'Tab':
				open = false;
				focusedIndex = -1;
				break;
		}
	}

	function handleFocus() {
		open = true;
	}

	function handleBlur() {
		// Delay closing to allow for option selection
		setTimeout(() => {
			open = false;
			focusedIndex = -1;
		}, 150);
	}

	function getOptionId(index: number) {
		return `${listboxId}-option-${index}`;
	}

	function getAriaActiveDescendant() {
		return focusedIndex >= 0 ? getOptionId(focusedIndex) : undefined;
	}

	function clearSelection() {
		search = '';
		value = undefined;
		open = false;
		focusedIndex = -1;
	}
</script>

<div class="relative">
	<label class="block text-sm font-medium text-gray-700 dark:text-gray-300" for={inputId}>
		Type *
	</label>

	<div class="relative">
		<input
			id={inputId}
			name="select-input"
			type="text"
			role="combobox"
			autocomplete="off"
			aria-expanded={open}
			aria-autocomplete="none"
			aria-controls={listboxId}
			aria-activedescendant={getAriaActiveDescendant()}
			aria-describedby={`${inputId}-description`}
			class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 pr-10 capitalize focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
			bind:value={search}
			oninput={handleInput}
			onkeydown={handleKeydown}
			onfocus={handleFocus}
			onblur={handleBlur}
			placeholder="Select or type to search"
			required
		/>

		{#if search}
			<button
				type="button"
				aria-label="Clear selection"
				class="absolute top-1/2 right-2 -translate-y-1/2 transform p-1 text-gray-400 hover:text-gray-600 focus:text-gray-600 focus:outline-none dark:hover:text-gray-300 dark:focus:text-gray-300"
				onclick={clearSelection}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						clearSelection();
					}
				}}
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					></path>
				</svg>
			</button>
		{/if}
	</div>

	<div id={`${inputId}-description`} class="sr-only">
		Use arrow keys to navigate options, Enter to select, Escape to close
	</div>

	{#if open}
		<ul
			id={listboxId}
			role="listbox"
			aria-label="Available options"
			class="absolute z-10 mt-2 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700"
		>
			{#if filtered.length}
				{#each filtered as opt, index (opt.id)}
					<li
						id={getOptionId(index)}
						role="option"
						aria-selected={focusedIndex === index}
						class="cursor-pointer px-3 py-2 capitalize hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:hover:bg-gray-600 dark:focus:bg-gray-600 {focusedIndex ===
						index
							? 'bg-gray-100 dark:bg-gray-600'
							: ''}"
						onclick={() => selectOption(opt)}
						onmouseenter={() => (focusedIndex = index)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								selectOption(opt);
							}
						}}
						tabindex="-1"
					>
						{opt.name}
					</li>
				{/each}
			{:else}
				<li
					class="px-3 py-2 text-gray-500 dark:text-gray-400"
					role="option"
					aria-selected="false"
					aria-disabled="true"
				>
					No matches
				</li>
			{/if}

			<!-- "Create …" action only visible with a valid entry not already in the list -->
			{#if search.length && !options
					.map((o) => o.name.toLocaleLowerCase())
					.includes(search.toLocaleLowerCase())}
				<li
					role="option"
					aria-selected={focusedIndex === filtered.length}
					class="cursor-pointer px-3 py-2 text-blue-600 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:text-blue-400 dark:hover:bg-gray-600 dark:focus:bg-gray-600 {focusedIndex ===
					filtered.length
						? 'bg-gray-100 dark:bg-gray-600'
						: ''}"
					onclick={attemptCreate}
					onmouseenter={() => (focusedIndex = filtered.length)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							attemptCreate();
						}
					}}
					tabindex="-1"
				>
					{loading ? `Creating "${search}"…` : `Create "${search}"…`}
				</li>
			{/if}
		</ul>
	{/if}
</div>

<style>
	/* Additional custom styling goes here if needed */
</style>
