<script lang="ts">
	import { browser } from '$app/environment';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import type { ProactiveSuggestion } from '$lib/types/db.js';
	import type { ProactiveSection } from '$lib/agent/proactive.js';

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
		suggestions.map((s) => ({
			id: s.id,
			createdAt: s.created_at,
			...parseSuggestionResult(s.result)
		}))
	);

	let dismissingIds = $state<Set<number>>(new Set());
	let approvingIds = $state<Set<number>>(new Set());

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
	<div class="mb-3 flex items-center justify-between">
		<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Mech suggests</h2>
		{#if items.length > 0}
			<p class="text-xs text-gray-500 dark:text-gray-400">
				{items.length} suggestion{items.length === 1 ? '' : 's'}
			</p>
		{/if}
	</div>

	{#if items.length === 0}
		<div
			class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50"
		>
			<p class="text-sm text-gray-500 dark:text-gray-400">
				{dismissingIds.size > 0 ? 'Dismissing…' : 'No suggestions right now.'}
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
