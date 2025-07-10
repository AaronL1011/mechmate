<script lang="ts">
	let {
		isOpen,
		title,
		message,
		onConfirm,
		onCancel
	}: {
		isOpen: boolean;
		title: string;
		message: string;
		onConfirm: () => void;
		onCancel: () => void;
	} = $props();

	let loading = $state(false);

	async function handleConfirm() {
		loading = true;
		try {
			onConfirm();
		} finally {
			loading = false;
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onCancel();
		}
	}
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex h-dvh w-full items-center justify-center overflow-y-auto bg-gray-600/50 backdrop-blur-sm dark:bg-gray-900/50"
		onclick={handleBackdropClick}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onkeydown={(e) => e.key === 'Escape' && onCancel()}
	>
		<div
			class="relative w-96 rounded-md border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:shadow-gray-900/50"
		>
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
				<button
					type="button"
					class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
					onclick={onCancel}
					aria-label="Close"
				>
					<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						></path>
					</svg>
				</button>
			</div>

			<div class="mb-6">
				<div class="mb-4 flex items-center">
					<div class="flex-shrink-0">
						<div
							class="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30"
						>
							<svg
								class="h-6 w-6 text-red-600 dark:text-red-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
								></path>
							</svg>
						</div>
					</div>
					<div class="ml-3">
						<p class="text-sm text-gray-700 dark:text-gray-300">{message}</p>
					</div>
				</div>
			</div>

			<div class="flex justify-end space-x-3">
				<button
					type="button"
					onclick={onCancel}
					disabled={loading}
					class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={handleConfirm}
					disabled={loading}
					class="rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
				>
					{loading ? 'Deleting...' : 'Delete'}
				</button>
			</div>
		</div>
	</div>
{/if}
