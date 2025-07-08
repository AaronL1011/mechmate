<script lang="ts">
	import type { Equipment, TaskType, EquipmentType } from '$lib/types/db.js';
	import ActionConfirmation from './ActionConfirmation.svelte';
	import { marked } from 'marked';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		equipment: Equipment[];
		taskTypes: TaskType[];
		equipmentTypes: EquipmentType[];
		onSuccess?: () => void;
	}

	const { isOpen, onClose, onSuccess }: Props = $props();

	// Component state
	let input = $state('');
	let isProcessing = $state(false);
	let isConfirming = $state(false);
	let pendingAction = $state<any>(null);
	let actionId = $state<string | null>(null);
	let responseMessage = $state<string>('');
	let errorMessage = $state<string>('');
	let showSuccessState = $state(false);

	let textareaElement: HTMLTextAreaElement | null = $state(null);

	// Configure marked for safe rendering
	marked.setOptions({
		breaks: true,
		gfm: true
	});

	function renderMarkdown(text: string): string {
		if (!text) return '';
		return marked(text) as string;
	}

	$effect(() => {
		if (isOpen && textareaElement) {
			textareaElement.focus();
			// Reset state when modal opens
			pendingAction = null;
			actionId = null;
			responseMessage = '';
			errorMessage = '';
			showSuccessState = false;
			input = '';
		}
	});

	function handleClose() {
		showSuccessState = false;
		onClose();
	}

	async function processInput() {
		if (!input.trim()) return;

		isProcessing = true;
		errorMessage = '';
		responseMessage = '';
		pendingAction = null;

		try {
			const response = await fetch('/api/quick-edit', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					prompt: input,
					context: 'modal'
				})
			});

			const data = await response.json();

			if (!data.success) {
				errorMessage = data.error || 'Failed to process request';
				return;
			}

			if (data.action && data.action_id) {
				// Action requires confirmation
				pendingAction = data.action;
				actionId = data.action_id;
			} else if (data.message) {
				// Text response from LLM
				responseMessage = data.message;
				input = '';
			}
		} catch (error) {
			console.error('Failed to process input:', error);
			errorMessage = 'Failed to connect to the service. Please try again.';
		} finally {
			isProcessing = false;
		}
	}

	async function confirmAction(updatedData?: any, userFeedback?: string) {
		if (!actionId) return;

		isConfirming = true;
		errorMessage = '';

		try {
			const response = await fetch('/api/quick-edit/confirm', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					action_id: actionId,
					confirmed: true,
					updated_data: updatedData,
					user_feedback: userFeedback
				})
			});

			const data = await response.json();

			if (!data.success) {
				errorMessage = data.error || 'Failed to execute action';
				return;
			}

			responseMessage = data.message || 'Action completed successfully';
			pendingAction = null;
			actionId = null;
			input = '';
			showSuccessState = true;

			// Call success callback to refresh data
			if (onSuccess) {
				onSuccess();
			}

			// Auto-close after a longer delay to show success state
			setTimeout(() => {
				if (isOpen) {
					handleClose();
				}
			}, 3000);
		} catch (error) {
			console.error('Failed to confirm action:', error);
			errorMessage = 'Failed to execute action. Please try again.';
		} finally {
			isConfirming = false;
		}
	}

	function cancelAction() {
		pendingAction = null;
		actionId = null;
		errorMessage = '';
		responseMessage = '';
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			if (pendingAction) {
				confirmAction();
			} else if (input.trim() && !isProcessing) {
				processInput();
			}
		} else if (event.key === 'Escape') {
			if (pendingAction) {
				cancelAction();
			} else {
				handleClose();
			}
		}
	}

	function getLoadingText(): string {
		const loadingTexts = [
			'Turning cogs...',
			'Throwing darts...',
			'Building torque...',
			'Testing circuits...',
			'Tensioning belts...',
			'Inspecting fluids...',
			'Scanning codes...',
			'Opening valves...',
			'Rolling bearings...',
			'Lubricating shafts...',
			'Torquing bolts...'
		];

		return loadingTexts[Math.floor(Math.random() * loadingTexts.length)];
	}
</script>

{#if isOpen}
	<div
		class="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-gray-100/60 backdrop-blur-md duration-200 dark:bg-gray-900/60"
	>
		<div class="animate-in zoom-in-95 mx-4 w-full max-w-lg p-6 duration-1000">
			<div class="mb-8" class:hidden={showSuccessState}>
				<div class="mb-2 flex h-fit items-center gap-3">
					<img src="/robot.png" alt="mech assistant" class="h-10 w-10" />
					<h2 class="text-xl font-semibold text-gray-900 dark:text-white">Mech Assistant</h2>
				</div>
				<p class="text-sm text-gray-600 dark:text-gray-400">
					I can help you create equipment records, schedule tasks, answer maintenance questions, or
					log completed jobs.
				</p>
			</div>

			<!-- Show success state -->
			{#if showSuccessState}
				<div class="animate-in zoom-in-95 py-8 text-center duration-300">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20"
					>
						<svg
							class="h-8 w-8 text-green-600 dark:text-green-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							></path>
						</svg>
					</div>
					<h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Success!</h3>
					<p class="mb-6 text-sm text-gray-600 dark:text-gray-400">{responseMessage}</p>
					<button
						onclick={handleClose}
						class="rounded-lg bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
					>
						Done
					</button>
				</div>
			{:else if pendingAction}
				<ActionConfirmation
					action={pendingAction}
					onConfirm={confirmAction}
					onCancel={cancelAction}
					{isConfirming}
				/>
			{:else}
				<!-- Error messages -->
				{#if errorMessage}
					<div class="scrollbar-hidden mb-4 flex max-h-[50vh] items-start gap-3 overflow-y-auto">
						<div
							class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30"
						>
							<img src="/robot.png" alt="assistant" class="h-5 w-5 opacity-75" />
						</div>
						<div
							class="max-w-xs rounded-2xl rounded-tl-sm bg-red-50 px-4 py-3 shadow-sm dark:bg-red-900/20"
						>
							<p class="text-sm leading-relaxed text-red-800 dark:text-red-200">{errorMessage}</p>
						</div>
					</div>
				{/if}

				<!-- Response messages for non-action responses -->
				{#if responseMessage && !showSuccessState}
					<div class="scrollbar-hidden mb-4 flex max-h-[50vh] items-start gap-3 overflow-y-auto">
						<div
							class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30"
						>
							<img src="/robot.png" alt="assistant" class="h-5 w-5" />
						</div>
						<div
							class="max-w-sm rounded-2xl rounded-tl-sm border border-gray-100 bg-gray-50 px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
						>
							<div
								class="prose prose-sm prose-gray dark:prose-invert prose-p:my-2 prose-p:leading-relaxed prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-code:text-blue-600
                       dark:prose-code:text-blue-400 prose-code:bg-gray-100
                       dark:prose-code:bg-gray-700 prose-code:px-1
                       prose-code:rounded prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-headings:text-gray-900 dark:prose-headings:text-gray-100
                       max-w-none text-sm leading-relaxed
                       text-gray-800 dark:text-gray-200"
							>
								{@html renderMarkdown(responseMessage)}
							</div>
						</div>
					</div>
				{/if}
				<!-- Input area -->
				<textarea
					bind:this={textareaElement}
					bind:value={input}
					rows={4}
					placeholder="e.g. 'Add my 2015 Honda Civic with 85,000 km' or 'Schedule an oil change on the bike every 3000 km'"
					class="text-md w-full resize-none rounded-2xl border border-gray-200 bg-white px-6 py-4 shadow-sm transition-colors focus:border-blue-500 focus:ring focus:ring-blue-500 lg:text-lg dark:border-gray-700 dark:bg-gray-800"
					onkeydown={handleKeyDown}
					disabled={isProcessing}
				></textarea>

				<div class="mt-6 flex justify-between">
					<button
						onclick={onClose}
						disabled={isProcessing}
						class="px-4 py-2 text-gray-600 transition-colors hover:text-gray-800 disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-200"
					>
						Cancel
					</button>
					<button
						disabled={!input.trim() || isProcessing}
						onclick={processInput}
						class="rounded-lg bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
					>
						{isProcessing ? getLoadingText() : 'Submit'}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
