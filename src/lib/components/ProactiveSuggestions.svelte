<script lang="ts">
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';

	interface Props {
		id: number;
		result: string;
		createdAt: string;
		onDismiss?: () => void;
	}

	const { id, result, createdAt, onDismiss }: Props = $props();

	marked.setOptions({ breaks: true, gfm: true });

	function renderMarkdown(text: string): string {
		if (!text) return '';
		return DOMPurify.sanitize(marked(text) as string);
	}

	function parseSections(text: string): { title: string; content: string }[] {
		const normalized = text.replace(/^##\s+(.+)$/gm, '**$1**:');
		const regex = /\*\*([^*]+)\*\*[:\s]*\n?([\s\S]*?)(?=\*\*[^*]+\*\*[:\s]*\n?|$)/g;
		const sections: { title: string; content: string }[] = [];
		let match;
		while ((match = regex.exec(normalized)) !== null) {
			const content = match[2].trim();
			if (content) {
				sections.push({ title: match[1].trim(), content });
			}
		}
		if (sections.length === 0 && text.trim()) {
			sections.push({ title: 'Suggestions', content: text.trim() });
		}
		return sections;
	}

	const sections = $derived(parseSections(result));
	let dismissedIndices = $state<Set<number>>(new Set());
	let isDismissing = $state(false);

	async function persistDismiss() {
		if (isDismissing) return;
		isDismissing = true;
		try {
			const res = await fetch('/api/agent/suggestions', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});
			if (res.ok) {
				onDismiss?.();
			}
		} finally {
			isDismissing = false;
		}
	}

	function dismiss(index: number) {
		dismissedIndices = new Set([...dismissedIndices, index]);
		if (dismissedIndices.size === sections.length) {
			persistDismiss();
		}
	}

	function dismissAll() {
		dismissedIndices = new Set(sections.map((_, i) => i));
		persistDismiss();
	}

	const visibleSections = $derived(
		sections.filter((_, index) => !dismissedIndices.has(index))
	);

	const visibleSectionsWithIndex = $derived(
		visibleSections.map((section) => ({
			section,
			globalIndex: sections.findIndex((s) => s === section)
		}))
	);
</script>

<div class="mb-8">
	<div class="mb-3 flex items-center justify-between">
		<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Mech suggests</h2>
		<p class="text-xs text-gray-500 dark:text-gray-400">
			Generated at {new Date(createdAt).toLocaleString()}
		</p>
	</div>

	{#if visibleSections.length === 0 && isDismissing}
		<div
			class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50"
		>
			<p class="text-sm text-gray-500 dark:text-gray-400">Dismissing…</p>
		</div>
	{:else if visibleSections.length > 0}
		<div class="flex flex-col gap-3">
			{#each visibleSectionsWithIndex as { section, globalIndex } (section.title + globalIndex)}
				<div
					class="group flex items-start gap-3 rounded-lg border border-amber-200/60 bg-amber-50/80 px-4 py-3 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/30"
					role="alert"
				>
					<div class="min-w-0 flex-1">
						<h3 class="mb-1.5 font-medium text-amber-900 dark:text-amber-100">
							{section.title}
						</h3>
						<div
							class="prose prose-sm max-w-none text-amber-900/90 dark:prose-invert dark:text-amber-100/90 [&_ul]:my-1 [&_li]:my-0.5"
						>
							{@html renderMarkdown(section.content) || '&#8203;'}
						</div>
					</div>
					<button
						type="button"
						onclick={() => dismiss(globalIndex)}
						aria-label="Dismiss {section.title}"
						class="shrink-0 rounded p-1 text-amber-600 opacity-70 transition-opacity hover:bg-amber-200/50 hover:opacity-100 dark:text-amber-400 dark:hover:bg-amber-800/50"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="18"
							height="18"
							viewBox="0 0 256 256"
							fill="currentColor"
							aria-hidden="true"
						>
							<path
								d="M205.66,194.34a8,8,0,0,0-11.32,11.32L128.69,128,194.34,62.34a8,8,0,0,0-11.32-11.32L117.37,116.69,51.71,51A8,8,0,0,0,40.34,62.34L106,128,40.34,193.66a8,8,0,0,0,11.32,11.32L117.37,139.31,194.34,205.66a8,8,0,0,0,11.32-11.32Z"
							/>
						</svg>
					</button>
				</div>
			{/each}
		</div>

		{#if visibleSections.length > 1}
			<button
				type="button"
				onclick={dismissAll}
				disabled={isDismissing}
				class="mt-2 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-300"
			>
				Dismiss all
			</button>
		{/if}
	{/if}
</div>
