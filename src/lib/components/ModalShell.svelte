<script lang="ts">
	import type { Snippet } from 'svelte';
	import { modalFooterClass } from './modalFormStyles.js';

	let {
		open,
		onClose,
		titleId,
		ariaLabel,
		size = 'lg',
		title,
		children,
		footer
	}: {
		open: boolean;
		onClose: () => void;
		titleId: string;
		ariaLabel?: string;
		size?: 'md' | 'lg';
		title: Snippet;
		children: Snippet;
		footer?: Snippet;
	} = $props();

	const maxW = $derived(size === 'md' ? 'max-w-md' : 'max-w-xl');

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gray-600/50 p-3 backdrop-blur-sm sm:p-4 dark:bg-gray-900/50"
		onclick={handleBackdropClick}
		role="presentation"
	>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="flex max-h-[min(90dvh,52rem)] w-full {maxW} flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl outline-none dark:border-gray-700 dark:bg-gray-800 dark:shadow-gray-900/50"
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			aria-label={ariaLabel}
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={handleKeydown}
		>
			<div
				class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5 dark:border-gray-700"
			>
				<h2 id={titleId} class="text-lg font-semibold text-gray-900 dark:text-white">
					{@render title()}
				</h2>
				<button
					type="button"
					class="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
					onclick={onClose}
					aria-label="Close dialog"
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

			<div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
				{@render children()}
			</div>

			{#if footer}
				<div
					class="{modalFooterClass} px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5"
				>
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
