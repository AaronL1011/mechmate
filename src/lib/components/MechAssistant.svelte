<script lang="ts">
	import ActionConfirmation from './ActionConfirmation.svelte';
	import { marked, Renderer } from 'marked';
	import DOMPurify from 'dompurify';
	import { onDestroy, tick } from 'svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		onSuccess?: () => void;
		initialPrompt?: string;
	}

	const { isOpen, onClose, onSuccess, initialPrompt }: Props = $props();

	type VoiceState = 'idle' | 'listening' | 'paused' | 'unsupported' | 'denied';

	type ConversationMessage =
		| { id: string; role: 'user'; content: string }
		| { id: string; role: 'assistant'; content: string }
		| { id: string; role: 'success'; content: string }
		| { id: string; role: 'error'; content: string };

	// SpeechRecognitionEvent: resultIndex = lowest changed index; results = cumulative list (Web Speech API)
	type SpeechResult = {
		resultIndex: number;
		results: Array<{ isFinal: boolean; 0?: { transcript: string } }>;
	};
	type SpeechRecognitionInstance = {
		continuous: boolean;
		interimResults: boolean;
		lang: string;
		start: () => void;
		stop: () => void;
		abort: () => void;
		onresult: (e: SpeechResult) => void;
		onend: () => void;
		onerror: (e: { error: string }) => void;
	};

	let messages = $state<ConversationMessage[]>([]);
	let input = $state('');
	let isProcessing = $state(false);
	let isConfirming = $state(false);
	let pendingAction = $state<any>(null);
	let actionId = $state<string | null>(null);
	let sessionId = $state<string | null>(null);
	let usedVoiceThisTurn = $state(false);
	let threadEl: HTMLDivElement | null = $state(null);

	let voiceState = $state<VoiceState>('idle');
	let voiceError = $state<string | null>(null);
	let textFallbackOpen = $state(false);
	let textareaElement: HTMLTextAreaElement | null = $state(null);

	let recognitionInstance: SpeechRecognitionInstance | null = $state(null);
	let shouldBeListening = false;
	let recognitionRestartTimer: ReturnType<typeof setTimeout> | null = null;
	/** Bumped on full session end / new session so delayed restart timers never revive a dead session. */
	let voiceSessionEpoch = 0;

	const hasSpeechRecognition =
		typeof window !== 'undefined' &&
		(typeof (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition !==
			'undefined' ||
			typeof (window as unknown as { webkitSpeechRecognition?: unknown })
				.webkitSpeechRecognition !== 'undefined');

	const voiceSupported = hasSpeechRecognition;

	const markdownRenderer = new Renderer();
	markdownRenderer.table = function (token) {
		const html = Renderer.prototype.table.call(this, token);
		return `<div class="mech-md-table-scroll max-w-full min-w-0 overflow-x-auto">${html}</div>`;
	};

	marked.use({ renderer: markdownRenderer });
	marked.setOptions({ breaks: true, gfm: true });

	function renderMarkdown(text: string): string {
		if (!text) return '';
		return DOMPurify.sanitize(marked(text) as string);
	}

	function newId(): string {
		return Math.random().toString(36).slice(2);
	}

	function pushMessage(msg: Omit<ConversationMessage, 'id'>) {
		messages = [...messages, { ...msg, id: newId() } as ConversationMessage];
	}

	// ─── Voice input ─────────────────────────────────────────────────────────

	function setVoiceError(message: string) {
		voiceError = message;
		voiceState = 'denied';
	}

	function clearRestartTimer() {
		if (recognitionRestartTimer !== null) {
			clearTimeout(recognitionRestartTimer);
			recognitionRestartTimer = null;
		}
	}

	function detachRecognitionHandlers(rec: SpeechRecognitionInstance) {
		rec.onresult = () => {};
		rec.onerror = () => {};
		rec.onend = () => {};
	}

	/**
	 * Stops the active SpeechRecognition instance, clears restart timers, and detaches handlers
	 * so late browser callbacks cannot mutate state after teardown.
	 */
	function stopRecognition() {
		clearRestartTimer();
		const rec = recognitionInstance;
		if (!rec) return;
		recognitionInstance = null;
		detachRecognitionHandlers(rec);
		try {
			rec.abort();
		} catch {
			try {
				rec.stop();
			} catch {
				/* already ended or invalid state */
			}
		}
	}

	// Creates a fresh SpeechRecognition instance and starts it. Called on initial
	// start and on every auto-restart triggered by onend (Chrome mobile fires onend
	// after each utterance even with continuous:true, so we restart to simulate
	// true continuous listening).
	function createAndStartRecognition(): void {
		clearRestartTimer();
		if (recognitionInstance) {
			stopRecognition();
		}

		const Win = window as unknown as {
			SpeechRecognition?: new () => SpeechRecognitionInstance;
			webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
		};
		const Recognition = Win.SpeechRecognition || Win.webkitSpeechRecognition;
		if (!Recognition) return;

		const sessionAtCreate = voiceSessionEpoch;
		const recognition = new Recognition() as SpeechRecognitionInstance;
		recognitionInstance = recognition;
		recognition.continuous = true;
		recognition.interimResults = false;
		recognition.lang = 'en-US';

		recognition.onresult = (event: SpeechResult) => {
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const result = event.results[i];
				if (result.isFinal !== true) continue;
				const transcript = result[0]?.transcript?.trim();
				if (!transcript) continue;
				input = input ? `${input} ${transcript}`.trim() : transcript;
			}
		};

		recognition.onerror = (event: { error: string }) => {
			if (event.error === 'aborted' || event.error === 'no-speech') return;
			if (event.error === 'not-allowed') {
				voiceSessionEpoch++;
				shouldBeListening = false;
				stopRecognition();
				setVoiceError(
					'Microphone access was denied. Allow microphone for this site in your browser settings and try again.'
				);
				return;
			}
			voiceError = `Speech error: ${event.error}. Tap Resume to try again.`;
		};

		recognition.onend = () => {
			if (recognitionInstance === recognition) {
				recognitionInstance = null;
			}
			detachRecognitionHandlers(recognition);
			if (voiceSessionEpoch !== sessionAtCreate) {
				return;
			}
			if (!shouldBeListening) {
				if (voiceState === 'listening') {
					voiceState = 'paused';
				}
				return;
			}
			if (recognitionInstance !== null) {
				return;
			}
			recognitionRestartTimer = setTimeout(() => {
				if (!shouldBeListening || voiceSessionEpoch !== sessionAtCreate) return;
				createAndStartRecognition();
			}, 150);
		};

		try {
			recognition.start();
		} catch {
			// start() can throw InvalidStateError if called too soon after a stop.
			if (recognitionInstance === recognition) {
				recognitionInstance = null;
			}
			detachRecognitionHandlers(recognition);
			try {
				recognition.abort();
			} catch {
				try {
					recognition.stop();
				} catch {
					/* ignore */
				}
			}
			recognitionRestartTimer = setTimeout(() => {
				if (!shouldBeListening || voiceSessionEpoch !== sessionAtCreate) return;
				createAndStartRecognition();
			}, 500);
		}
	}

	function startVoiceInput() {
		voiceError = null;
		if (typeof window !== 'undefined' && !window.isSecureContext) {
			voiceState = 'denied';
			voiceError =
				'Microphone access requires a secure page (HTTPS or localhost). Open the app via https://localhost in dev, or use "Type instead" below.';
			return;
		}
		if (!voiceSupported) {
			voiceState = 'unsupported';
			voiceError =
				'Speech input is not supported in this browser. Try Chrome or Edge, or use "Type instead" below.';
			return;
		}

		voiceSessionEpoch++;
		shouldBeListening = true;
		usedVoiceThisTurn = true;
		voiceState = 'listening';
		createAndStartRecognition();
	}

	function pauseVoice() {
		shouldBeListening = false;
		stopRecognition();
		voiceState = 'paused';
	}

	function resumeVoice() {
		voiceError = null;
		shouldBeListening = true;
		voiceState = 'listening';
		createAndStartRecognition();
	}

	function cancelVoice() {
		voiceSessionEpoch++;
		shouldBeListening = false;
		stopRecognition();
		voiceState = 'idle';
		input = '';
	}

	function sendAndCloseVoice() {
		voiceSessionEpoch++;
		shouldBeListening = false;
		stopRecognition();
		voiceState = 'idle';
		if (input.trim()) processInput();
	}

	function handlePrimaryVoiceButton() {
		if (voiceState === 'idle') {
			startVoiceInput();
			return;
		}
		if (voiceState === 'listening' || voiceState === 'paused') {
			if (!input.trim() || isProcessing) return;
			sendAndCloseVoice();
		}
	}

	// ─── Effects ─────────────────────────────────────────────────────────────

	$effect(() => {
		if (!isOpen) {
			cancelVoice();
			return;
		}
		if (isOpen) {
			messages = [];
			pendingAction = null;
			actionId = null;
			input = '';
			voiceError = null;
			textFallbackOpen = false;
			if (!voiceSupported) voiceState = 'unsupported';
			else voiceState = 'idle';
			if (initialPrompt?.trim()) {
				input = initialPrompt;
				tick().then(() => processInput());
			}
		}
	});

	$effect(() => {
		// Scroll to bottom whenever messages, pendingAction, or isProcessing change.
		const _m = messages;
		const _p = pendingAction;
		const _i = isProcessing;
		tick().then(() => {
			if (threadEl) threadEl.scrollTop = threadEl.scrollHeight;
		});
	});

	onDestroy(() => {
		cancelVoice();
	});

	// ─── Actions ─────────────────────────────────────────────────────────────

	function handleClose() {
		cancelVoice();
		messages = [];
		onClose();
	}

	async function submitAgentPrompt(
		promptText: string,
		options: { pushUser: boolean; context?: string }
	) {
		if (options.pushUser) {
			pushMessage({ role: 'user', content: promptText });
		}
		isProcessing = true;
		try {
			const response = await fetch('/api/agent/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					prompt: promptText,
					context: options.context ?? 'text',
					...(sessionId ? { session_id: sessionId } : {})
				})
			});

			const data = await response.json();

			if (!data.success) {
				pushMessage({ role: 'error', content: data.error || 'Failed to process request.' });
				return;
			}

			usedVoiceThisTurn = false;
			if (data.session_id) sessionId = data.session_id;

			if (data.action && data.action_id) {
				pendingAction = data.action;
				actionId = data.action_id;
			} else if (data.message) {
				pushMessage({ role: 'assistant', content: data.message });
			}
		} catch {
			pushMessage({
				role: 'error',
				content: 'Failed to connect to the service. Please try again.'
			});
		} finally {
			isProcessing = false;
		}
	}

	async function processInput() {
		if (!input.trim()) return;

		const userContent = input.trim();
		input = '';
		await submitAgentPrompt(userContent, {
			pushUser: true,
			context: usedVoiceThisTurn ? 'voice' : 'text'
		});
	}

	async function confirmAction(updatedData?: any, userFeedback?: string) {
		if (!actionId) return;

		isConfirming = true;

		try {
			const response = await fetch('/api/agent/actions/confirm', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action_id: actionId,
					confirmed: true,
					updated_data: updatedData,
					user_feedback: userFeedback
				})
			});

			const data = await response.json();

			pendingAction = null;
			actionId = null;

			if (!data.success) {
				pushMessage({ role: 'error', content: data.error || 'Failed to execute action.' });
				return;
			}

			pushMessage({ role: 'success', content: data.message || 'Action completed successfully.' });

			const trimmedFeedback = userFeedback?.trim();
			if (trimmedFeedback) {
				const followUpPrompt = `I confirmed that change. Additional context: ${trimmedFeedback}`;
				await submitAgentPrompt(followUpPrompt, { pushUser: true, context: 'text' });
			}

			if (onSuccess) onSuccess();

			setTimeout(() => {
				if (isOpen) handleClose();
			}, 1800);
		} catch {
			pendingAction = null;
			actionId = null;
			pushMessage({ role: 'error', content: 'Failed to execute action. Please try again.' });
		} finally {
			isConfirming = false;
		}
	}

	function cancelAction() {
		pendingAction = null;
		actionId = null;
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
		const texts = [
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
		return texts[Math.floor(Math.random() * texts.length)];
	}
</script>

{#if isOpen}
	<div
		class="animate-in fade-in fixed inset-0 z-50 flex items-end justify-center bg-gray-900/50 backdrop-blur-sm duration-150 sm:items-center dark:bg-black/60"
	>
		<div
			class="animate-in slide-in-from-bottom-4 sm:zoom-in-95 flex h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl duration-200 sm:mx-4 sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-2xl dark:bg-gray-900"
		>
			<!-- Header -->
			<header
				class="flex flex-shrink-0 items-center gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800"
			>
				<span class="flex-1 text-sm font-semibold tracking-wide text-gray-900 dark:text-white"
					>Ask Mech</span
				>
				{#if sessionId}
					<span
						class="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-400"
					>
						<span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
						session active
					</span>
				{/if}
				<button
					onclick={handleClose}
					aria-label="Close"
					class="ml-2 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</header>

			<!-- Thread -->
			<div
				bind:this={threadEl}
				class="scrollbar-hidden flex-1 overflow-y-auto px-5 py-5"
			>
				{#if messages.length === 0 && !pendingAction && !isProcessing}
					<!-- Empty state -->
					<div class="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
						<img src="/robot.png" alt="" class="h-12 w-12 opacity-40" />
						<p class="text-sm font-medium text-gray-400 dark:text-gray-500">
							Ask Mech anything about your equipment.
						</p>
						<p class="text-xs text-gray-300 dark:text-gray-600">
							Create records · schedule tasks · log jobs · ask questions
						</p>
					</div>
				{:else}
					<div class="flex flex-col gap-4">
						{#each messages as msg (msg.id)}
							{#if msg.role === 'user'}
								<!-- User bubble: right-aligned -->
								<div class="flex justify-end">
									<div
										class="max-w-[80%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm dark:bg-blue-700"
									>
										{msg.content}
									</div>
								</div>
							{:else if msg.role === 'assistant'}
								<!-- Assistant bubble: left-aligned -->
								<div class="flex min-w-0 items-start gap-2.5">
									<img src="/robot.png" alt="Mech" class="mt-0.5 h-8 w-8 flex-shrink-0" />
									<div
										class="min-w-0 max-w-[88%] rounded-2xl rounded-tl-sm border border-gray-100 bg-gray-50 px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
									>
										<div
											class="prose prose-sm prose-gray dark:prose-invert prose-p:my-1.5 prose-p:leading-relaxed prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-code:rounded prose-code:bg-gray-100 prose-code:px-1 prose-code:text-blue-600 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:text-gray-900 dark:prose-code:bg-gray-700 dark:prose-code:text-blue-400 dark:prose-headings:text-gray-100 max-w-none min-w-0 text-sm leading-relaxed text-gray-700 dark:text-gray-200"
										>
											{@html renderMarkdown(msg.content)}
										</div>
									</div>
								</div>
							{:else if msg.role === 'success'}
								<!-- Success bubble: left-aligned, green tint -->
								<div class="flex items-start gap-2.5">
									<div
										class="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
										aria-hidden="true"
									>
										<svg
											class="h-6 w-6 text-green-600 dark:text-green-400"
											viewBox="0 0 24 24"
											fill="none"
										>
											<path
												class="mech-success-tick-path"
												pathLength="1"
												d="M5 13l4 4L19 7"
												stroke="currentColor"
												stroke-width="2.5"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
										</svg>
									</div>
									<div
										class="max-w-[88%] rounded-2xl rounded-tl-sm border border-green-100 bg-green-50 px-4 py-3 shadow-sm dark:border-green-900/40 dark:bg-green-900/20"
									>
										<p class="text-sm leading-relaxed text-green-800 dark:text-green-200">
											{msg.content}
										</p>
									</div>
								</div>
							{:else if msg.role === 'error'}
								<!-- Error bubble: left-aligned, amber tint -->
								<div class="flex items-start gap-2.5">
									<img src="/robot.png" alt="Mech" class="mt-0.5 h-8 w-8 flex-shrink-0 opacity-60" />
									<div
										class="max-w-[88%] rounded-2xl rounded-tl-sm border border-amber-100 bg-amber-50 px-4 py-3 shadow-sm dark:border-amber-900/40 dark:bg-amber-900/20"
									>
										<p class="text-sm leading-relaxed text-amber-800 dark:text-amber-200">
											{msg.content}
										</p>
									</div>
								</div>
							{/if}
						{/each}

						<!-- Typing indicator -->
						{#if isProcessing && !pendingAction}
							<div class="flex items-start gap-2.5">
								<img src="/robot.png" alt="Mech" class="mt-0.5 h-8 w-8 flex-shrink-0 opacity-60" />
								<div
									class="rounded-2xl rounded-tl-sm border border-gray-100 bg-gray-50 px-4 py-3.5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
								>
									<div class="flex items-center gap-1">
										<span
											class="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 dark:bg-gray-500"
											style="animation-delay: 0ms"
										></span>
										<span
											class="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 dark:bg-gray-500"
											style="animation-delay: 150ms"
										></span>
										<span
											class="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 dark:bg-gray-500"
											style="animation-delay: 300ms"
										></span>
									</div>
								</div>
							</div>
						{/if}

						<!-- Action confirmation rendered inline in thread -->
						{#if pendingAction && actionId}
							<div class="flex min-w-0 max-w-full items-start gap-2.5">
								<img src="/robot.png" alt="Mech" class="mt-0.5 h-6 w-6 flex-shrink-0" />
								<div
									class="min-w-0 max-w-[88%] rounded-2xl rounded-tl-sm border border-gray-100 bg-gray-50 px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
								>
									{#key actionId}
										<ActionConfirmation
											action={pendingAction}
											onConfirm={confirmAction}
											onCancel={cancelAction}
											{isConfirming}
										/>
									{/key}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Footer: voice/text input (hidden when action pending) -->
			{#if !pendingAction}
				<footer
					class="flex-shrink-0 border-t border-gray-100 px-5 pt-4 pb-6 dark:border-gray-800"
				>
					<!-- Voice error banner -->
					{#if voiceError}
						<div
							class="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
						>
							{voiceError}
						</div>
					{/if}

					<!-- Voice input area -->
					<div class="mb-5">
						{#if voiceState === 'idle' && voiceSupported}
							<div class="flex justify-center">
								<button
									type="button"
									disabled={isProcessing}
									onclick={handlePrimaryVoiceButton}
									aria-label="Start voice input"
									class="flex h-24 w-24 min-h-[6rem] min-w-[6rem] items-center justify-center rounded-full border-2 border-dashed border-blue-200 bg-blue-50/60 text-blue-700 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-100/60 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-900/10 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:bg-blue-900/20"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-10 w-10"
										fill="currentColor"
										viewBox="0 0 256 256"
										aria-hidden="true"
									>
										<path
											d="M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0Zm40,143.6V240a8,8,0,0,1-16,0V207.6A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,128,0,8,8,0,0,1,16,0A80.11,80.11,0,0,1,136,207.6Z"
										></path>
									</svg>
								</button>
							</div>
						{:else if voiceState === 'listening' || voiceState === 'paused'}
							<div class="mx-auto max-w-md">
								<div
									class="mb-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
									aria-live="polite"
								>
									<p class="text-xs font-medium tracking-wide text-gray-400 dark:text-gray-500">
										{voiceState === 'listening' ? 'Listening…' : 'Paused'}
									</p>
									<p
										class="mt-0.5 text-sm leading-relaxed {input
											? 'text-gray-800 dark:text-gray-200'
											: 'italic text-gray-400 dark:text-gray-500'}"
									>
										{input || 'Say something…'}
									</p>
								</div>
								<div class="flex items-center justify-center gap-6 sm:gap-7">
									{#if voiceState === 'listening'}
										<button
											type="button"
											onclick={pauseVoice}
											aria-label="Pause recording"
											title="Pause"
											class="flex h-[4.5rem] w-[4.5rem] min-h-[4.5rem] min-w-[4.5rem] shrink-0 items-center justify-center rounded-full border-2 border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-8 w-8"
												fill="currentColor"
												viewBox="0 0 256 256"
												aria-hidden="true"
											>
												<path
													d="M216,48V208a16,16,0,0,1-16,16H160a16,16,0,0,1-16-16V48a16,16,0,0,1,16-16h40A16,16,0,0,1,216,48ZM96,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Z"
												></path>
											</svg>
										</button>
									{:else}
										<button
											type="button"
											onclick={resumeVoice}
											aria-label="Resume recording"
											title="Resume"
											class="flex h-[4.5rem] w-[4.5rem] min-h-[4.5rem] min-w-[4.5rem] shrink-0 items-center justify-center rounded-full border-2 border-blue-200 bg-blue-50 text-blue-700 shadow-sm transition-colors hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-8 w-8"
												fill="currentColor"
												viewBox="0 0 256 256"
												aria-hidden="true"
											>
												<path
													d="M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.78,15.78,0,0,0,64,39.87V216.13A15.78,15.78,0,0,0,72.12,229.98a16,16,0,0,0,16.2-.27l144.08-88.14a15.76,15.76,0,0,0,0-27Z"
												></path>
											</svg>
										</button>
									{/if}

									<div class="relative h-24 w-24 shrink-0">
										{#if voiceState === 'listening'}
											<span
												class="mech-voice-ring mech-voice-ring--listening absolute inset-0 rounded-full"
												aria-hidden="true"
											></span>
										{:else}
											<span
												class="mech-voice-ring mech-voice-ring--paused absolute inset-0 rounded-full"
												aria-hidden="true"
											></span>
										{/if}
										<button
											type="button"
											disabled={!input.trim() || isProcessing}
											onclick={handlePrimaryVoiceButton}
											aria-label={!input.trim()
												? 'Speak to add text, then tap to send to Mech'
												: 'Send voice message to Mech'}
											aria-pressed={voiceState === 'listening'}
											title={!input.trim() ? 'Add speech to send' : 'Send to Mech'}
											class="absolute inset-[4.5px] flex items-center justify-center rounded-full text-white shadow-md transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-blue-500 {voiceState ===
											'paused'
												? 'bg-blue-600/80 dark:bg-blue-700/80'
												: 'bg-blue-600 dark:bg-blue-600'}"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-10 w-10"
												fill="currentColor"
												viewBox="0 0 256 256"
												aria-hidden="true"
											>
												<path
													d="M227.32,28.68a16,16,0,0,0-15.66-4.08l-.15,0L19.57,82.84a16,16,0,0,0-2.49,29.8L102,154l41.3,84.87A15.86,15.86,0,0,0,157.74,248q.69,0,1.38-.06a15.88,15.88,0,0,0,14-11.51l58.2-191.94c0-.05,0-.1,0-.15A16,16,0,0,0,227.32,28.68ZM157.83,231.85l-.05.14,0-.07-40.06-82.3,48-48a8,8,0,0,0-11.31-11.31l-48,48L24.08,98.25l-.07,0,.14,0L216,40Z"
												></path>
											</svg>
										</button>
									</div>

									<button
										type="button"
										onclick={cancelVoice}
										aria-label="Stop and clear voice input"
										title="Cancel"
										class="flex h-[4.5rem] w-[4.5rem] min-h-[4.5rem] min-w-[4.5rem] shrink-0 items-center justify-center rounded-full border-2 border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-8 w-8"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											viewBox="0 0 24 24"
											aria-hidden="true"
										>
											<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
							</div>
						{:else if voiceState === 'unsupported' || voiceState === 'denied'}
							<!-- Fallback: show text input automatically when voice unavailable -->
						{/if}
					</div>

					<!-- Text fallback toggle (kept in DOM while recording so footer layout does not shift) -->
					<div>
						{#if voiceState !== 'unsupported' && voiceState !== 'denied' && voiceSupported}
							{@const hideTypeToggle =
								voiceState === 'listening' || voiceState === 'paused'}
							<button
								type="button"
								onclick={() => (textFallbackOpen = !textFallbackOpen)}
								aria-hidden={hideTypeToggle ? true : undefined}
								tabindex={hideTypeToggle ? -1 : undefined}
								class="mb-2 flex w-full items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 {hideTypeToggle
									? 'invisible pointer-events-none select-none'
									: ''}"
							>
								{textFallbackOpen ? 'Hide text input' : 'Type instead'}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-3 w-3 transition-transform {textFallbackOpen ? 'rotate-180' : ''}"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 9l-7 7-7-7"
									/>
								</svg>
							</button>
						{/if}

						{#if textFallbackOpen || voiceState === 'unsupported' || voiceState === 'denied'}
							<div class="relative">
								<textarea
									bind:this={textareaElement}
									bind:value={input}
									rows={2}
									placeholder="e.g. 'Log an oil change on the Honda Civic at 87,500 km'"
									class="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 pr-14 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
									onkeydown={handleKeyDown}
									disabled={isProcessing}
								></textarea>
								<button
									disabled={!input.trim() || isProcessing}
									onclick={processInput}
									class="absolute bottom-3 right-3 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 dark:bg-blue-700 dark:hover:bg-blue-600"
								>
									{isProcessing ? getLoadingText() : 'Send'}
								</button>
							</div>
						{/if}
					</div>
				</footer>
			{/if}
		</div>
	</div>
{/if}

<style>
	.mech-voice-ring--listening {
		background: conic-gradient(
			from 0deg,
			rgb(59, 130, 246),
			rgb(34, 211, 238),
			rgb(147, 197, 253),
			rgb(59, 130, 246)
		);
		animation: mech-voice-ring-spin 2.2s linear infinite;
	}

	.mech-voice-ring--paused {
		background: conic-gradient(
			from 90deg,
			rgb(59, 130, 246),
			rgb(100, 116, 139),
			rgb(96, 165, 250),
			rgb(59, 130, 246)
		);
		animation: mech-voice-ring-paused-pulse 2.5s ease-in-out infinite;
		opacity: 0.92;
	}

	@keyframes mech-voice-ring-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes mech-voice-ring-paused-pulse {
		0%,
		100% {
			opacity: 0.75;
		}
		50% {
			opacity: 1;
		}
	}

	@keyframes mech-voice-ring-soft-pulse {
		0%,
		100% {
			opacity: 0.65;
		}
		50% {
			opacity: 1;
		}
	}

	@keyframes mech-success-tick-draw {
		to {
			stroke-dashoffset: 0;
		}
	}

	.mech-success-tick-path {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: mech-success-tick-draw 1.8s ease-out forwards;
	}

	@media (prefers-reduced-motion: reduce) {
		.mech-voice-ring--listening {
			animation: mech-voice-ring-soft-pulse 1.8s ease-in-out infinite;
		}

		.mech-voice-ring--paused {
			animation: none;
			opacity: 0.88;
		}

		.mech-success-tick-path {
			animation: none;
			stroke-dashoffset: 0;
		}
	}
</style>
