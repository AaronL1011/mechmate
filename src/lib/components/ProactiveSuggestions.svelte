<script lang="ts">
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import type { ProactiveSuggestion } from '$lib/types/db.js';
	import {
		PROACTIVE_MAX_ACTIVE_SUGGESTIONS,
		type ProactiveSection
	} from '$lib/agent/proactiveShared.js';

	interface Props {
		suggestions: ProactiveSuggestion[];
		onDismiss?: (id: number) => void;
		onApprove?: (agentAction: string) => void;
	}

	const { suggestions, onDismiss, onApprove }: Props = $props();

	marked.setOptions({ breaks: true, gfm: true });

	function renderMarkdown(text: string): string {
		if (!text) return '';
		const html = marked(text) as string;
		if (browser) {
			return DOMPurify.sanitize(html);
		}
		return html.replace(/<script[\s\S]*?<\/script>/gi, '');
	}

	function parseSuggestionResult(result: string): ProactiveSection {
		try {
			const parsed = JSON.parse(result) as unknown;
			if (
				typeof parsed === 'object' &&
				parsed !== null &&
				typeof (parsed as ProactiveSection).title === 'string' &&
				typeof (parsed as ProactiveSection).content === 'string'
			) {
				return parsed as ProactiveSection;
			}
		} catch {
			// fall through to legacy
		}
		return { title: 'Summary', content: result };
	}

	const items = $derived(
		suggestions.slice(0, PROACTIVE_MAX_ACTIVE_SUGGESTIONS).map((s) => ({
			id: s.id,
			createdAt: s.created_at,
			...parseSuggestionResult(s.result)
		}))
	);

	let dismissingIds = $state<Set<number>>(new Set());
	let approvingIds = $state<Set<number>>(new Set());
	let refreshing = $state(false);

	async function refreshSuggestions() {
		if (refreshing) return;
		refreshing = true;
		try {
			const res = await fetch('/api/agent/suggestions', { method: 'POST' });
			if (res.ok) {
				await invalidateAll();
			}
		} finally {
			refreshing = false;
		}
	}

	async function approve(id: number, agentAction: string) {
		if (approvingIds.has(id)) return;
		approvingIds = new Set([...approvingIds, id]);
		try {
			await dismiss(id);
			onApprove?.(agentAction);
		} finally {
			approvingIds = new Set([...approvingIds].filter((x) => x !== id));
		}
	}

	async function dismiss(id: number) {
		if (dismissingIds.has(id)) return;
		dismissingIds = new Set([...dismissingIds, id]);
		try {
			const res = await fetch('/api/agent/suggestions', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});
			if (res.ok) {
				onDismiss?.(id);
			}
		} finally {
			dismissingIds = new Set([...dismissingIds].filter((x) => x !== id));
		}
	}

	async function dismissAll() {
		const ids = items.map((i) => i.id);
		for (const id of ids) {
			await dismiss(id);
		}
	}
</script>

<div class="mb-8">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Mech suggests</h2>
		<button
			type="button"
			class="inline-flex shrink-0 rounded p-1 text-gray-500 transition-colors hover:bg-gray-200/70 hover:text-gray-700 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700/60 dark:hover:text-gray-200"
			onclick={refreshSuggestions}
			disabled={refreshing}
			aria-label="Refresh suggestions"
			aria-busy={refreshing}
		>
			<span
				class="proactive-refresh-icon inline-flex"
				class:proactive-refresh-icon--spinning={refreshing}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 shrink-0"
					fill="currentColor"
					viewBox="0 0 256 256"
					aria-hidden="true"
				>
					<path
						d="M228,48V96a12,12,0,0,1-12,12H168a12,12,0,0,1,0-24h19l-7.8-7.8a75.55,75.55,0,0,0-53.32-22.26h-.43A75.49,75.49,0,0,0,72.39,75.57,12,12,0,1,1,55.61,58.41a99.38,99.38,0,0,1,69.87-28.47H126A99.42,99.42,0,0,1,196.2,59.23L204,67V48a12,12,0,0,1,24,0ZM183.61,180.43a75.49,75.49,0,0,1-53.09,21.63h-.43A75.55,75.55,0,0,1,76.77,179.8L69,172H88a12,12,0,0,0,0-24H40a12,12,0,0,0-12,12v48a12,12,0,0,0,24,0V189l7.8,7.8A99.42,99.42,0,0,0,130,226.06h.56a99.38,99.38,0,0,0,69.87-28.47,12,12,0,0,0-16.78-17.16Z"
					></path>
				</svg>
			</span>
		</button>
	</div>

	{#if items.length === 0}
		<div
			class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50"
		>
			<p class="text-sm text-gray-500 dark:text-gray-400">
				{dismissingIds.size > 0
					? 'Dismissing…'
					: refreshing
						? 'Refreshing…'
						: 'No suggestions right now.'}
			</p>
		</div>
	{:else}
		<div class="flex flex-col gap-3">
			{#each items as item (item.id)}
				<div
					class="group flex flex-col items-start gap-3 rounded-lg border border-amber-200/60 bg-amber-50/80 px-4 py-3 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/30"
					role="alert"
				>
					<div class="min-w-0 flex-1">
						<h3 class="mb-1.5 text-sm sm:text-base font-medium text-amber-900 dark:text-amber-100">
							{item.title}
						</h3>
						<div
							class="prose prose-sm max-w-none text-amber-900/90 dark:prose-invert dark:text-amber-100/90 max-sm:[&_p]:text-[0.75rem] max-sm:[&_li]:text-[0.75rem] [&_ul]:my-1 [&_li]:my-0.5"
						>
							{@html renderMarkdown(item.content) || '&#8203;'}
						</div>
					</div>
					<div class="flex shrink-0 items-center gap-1 ml-auto">
						{#if item.agent_action}
							<button
								type="button"
								onclick={() => approve(item.id, item.agent_action!)}
								disabled={approvingIds.has(item.id) || dismissingIds.has(item.id)}
								aria-label="Approve {item.title}"
								class="text-sm lg:text-base rounded p-1 px-2 text-emerald-600 opacity-70 transition-opacity hover:bg-emerald-200/50 hover:opacity-100 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-800/50"
							>
								action
							</button>
						{/if}
						<button
							type="button"
							onclick={() => dismiss(item.id)}
							disabled={dismissingIds.has(item.id)}
							aria-label="Dismiss {item.title}"
							class="text-sm lg:text-base rounded p-1 px-2 text-amber-600 opacity-70 transition-opacity hover:bg-amber-200/50 hover:opacity-100 disabled:opacity-50 dark:text-amber-400 dark:hover:bg-amber-800/50"
						>
							dismiss
						</button>
					</div>
				</div>
			{/each}
		</div>

		{#if items.length > 1}
			<button
				type="button"
				onclick={dismissAll}
				disabled={dismissingIds.size > 0}
				class="mt-2 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-300"
			>
				Dismiss all
			</button>
		{/if}
	{/if}
</div>

<style>
	.proactive-refresh-icon {
		transform-origin: center;
	}

	.proactive-refresh-icon--spinning {
		animation: proactive-refresh-spin 1.5s infinite;
	}

	@keyframes proactive-refresh-spin {
		0% {
			transform: rotate(0deg);
			animation-timing-function: ease-in-out;
		}
		50% {
			transform: rotate(180deg);
			animation-timing-function: ease-in-out;
		}
		100% {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.proactive-refresh-icon--spinning {
			animation: none;
		}
	}
</style>
