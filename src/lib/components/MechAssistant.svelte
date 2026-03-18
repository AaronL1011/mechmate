<script lang="ts">
	import ActionConfirmation from './ActionConfirmation.svelte';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import { tick } from 'svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		onSuccess?: () => void;
	}

	const { isOpen, onClose, onSuccess }: Props = $props();

	type VoiceState = 'idle' | 'requesting' | 'listening' | 'paused' | 'unsupported' | 'denied';

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
	let waveformCanvas: HTMLCanvasElement | null = $state(null);

	let mediaStream: MediaStream | null = $state(null);
	let recognitionInstance: SpeechRecognitionInstance | null = $state(null);
	let audioContext: AudioContext | null = $state(null);
	let analyserNode: AnalyserNode | null = $state(null);
	let waveformAnimationId = $state<number | null>(null);
	let interimTranscript = $state('');
	let shouldBeListening = false;
	let recognitionRestartTimer: ReturnType<typeof setTimeout> | null = null;

	const hasSpeechRecognition =
		typeof window !== 'undefined' &&
		(typeof (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition !==
			'undefined' ||
			typeof (window as unknown as { webkitSpeechRecognition?: unknown })
				.webkitSpeechRecognition !== 'undefined');

	const hasGetUserMedia =
		typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

	const isMobile =
		typeof navigator !== 'undefined' &&
		/Android|iPhone|iPad|iPod|webOS|Mobile/i.test(navigator.userAgent);

	// On mobile Chrome, getUserMedia and SpeechRecognition compete for the mic; only one works.
	// Skip waveform (getUserMedia) on mobile so SpeechRecognition gets exclusive access.
	const useWaveform = hasGetUserMedia && !isMobile;

	const voiceSupported = hasSpeechRecognition && (hasGetUserMedia || isMobile);

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

	// ─── Canvas / waveform ───────────────────────────────────────────────────

	function setupCanvas(el: HTMLCanvasElement) {
		function resize() {
			const dpr = window.devicePixelRatio || 1;
			const rect = el.getBoundingClientRect();
			el.width = rect.width * dpr;
			el.height = rect.height * dpr;
		}
		resize();
		const ro = new ResizeObserver(resize);
		ro.observe(el);
		return {
			destroy() {
				ro.disconnect();
			}
		};
	}

	function stopWaveform() {
		if (waveformAnimationId != null) {
			cancelAnimationFrame(waveformAnimationId);
			waveformAnimationId = null;
		}
		analyserNode = null;
		if (audioContext?.state !== 'closed') {
			audioContext?.close();
		}
		audioContext = null;
	}

	function releaseMicrophone() {
		mediaStream?.getTracks().forEach((t) => t.stop());
		mediaStream = null;
	}

	function drawWaveform() {
		const canvas = waveformCanvas;
		const analyser = analyserNode;
		if (!canvas || !analyser) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const c: HTMLCanvasElement = canvas;
		const a: AnalyserNode = analyser;
		const g: CanvasRenderingContext2D = ctx;

		const BAR_COUNT = 28;
		const dataArray = new Uint8Array(a.frequencyBinCount);

		function frame() {
			waveformAnimationId = requestAnimationFrame(frame);
			a.getByteFrequencyData(dataArray);

			const dpr = window.devicePixelRatio || 1;
			const w = c.width / dpr;
			const h = c.height / dpr;

			g.clearRect(0, 0, c.width, c.height);
			g.save();
			g.scale(dpr, dpr);

			const isDark = document.documentElement.classList.contains('dark');
			const barColor = isDark ? 'rgb(96 165 250)' : 'rgb(59 130 246)';
			const silentColor = isDark ? 'rgba(148 163 184 / 0.3)' : 'rgba(148 163 184 / 0.35)';

			const totalGap = w * 0.08;
			const barW = (w - totalGap) / BAR_COUNT - totalGap / BAR_COUNT;
			const spacing = (w - barW * BAR_COUNT) / (BAR_COUNT + 1);
			const cy = h / 2;
			const maxHalf = h * 0.42;

			for (let i = 0; i < BAR_COUNT; i++) {
				const t = i / (BAR_COUNT - 1);
				const taper = 0.15 + 0.85 * Math.pow(Math.sin(t * Math.PI), 0.7);
				const bucketIndex = Math.floor((i / BAR_COUNT) * (a.frequencyBinCount * 0.6));
				const value = dataArray[bucketIndex] ?? 0;
				const normalised = value / 255;
				const halfH = Math.max(1.5, normalised * maxHalf * taper);
				const x = spacing + i * (barW + spacing);
				const radius = Math.min(barW / 2, halfH, 3);

				if (normalised < 0.02) {
					g.fillStyle = silentColor;
					g.beginPath();
					g.roundRect(x, cy - 1.5, barW, 3, 1.5);
					g.fill();
				} else {
					g.fillStyle = barColor;
					g.beginPath();
					g.roundRect(x, cy - halfH, barW, halfH * 2, radius);
					g.fill();
				}
			}

			g.restore();
		}
		frame();
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

	function stopRecognition() {
		clearRestartTimer();
		if (recognitionInstance) {
			try {
				recognitionInstance.abort();
			} catch {
				try {
					recognitionInstance.stop();
				} catch {}
			}
			recognitionInstance = null;
		}
	}

	// Creates a fresh SpeechRecognition instance and starts it. Called on initial
	// start and on every auto-restart triggered by onend (Chrome mobile fires onend
	// after each utterance even with continuous:true, so we restart to simulate
	// true continuous listening).
	function createAndStartRecognition(): void {
		clearRestartTimer();

		const Win = window as unknown as {
			SpeechRecognition?: new () => SpeechRecognitionInstance;
			webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
		};
		const Recognition = Win.SpeechRecognition || Win.webkitSpeechRecognition;
		if (!Recognition) return;

		const recognition = new Recognition() as SpeechRecognitionInstance;
		recognitionInstance = recognition;
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.lang = 'en-US';

		recognition.onresult = (event: SpeechResult) => {
			// Per Web Speech API: process only changed results (resultIndex..length)
			// Each result: isFinal → append to accumulated input; !isFinal → replace interim display
			let lastInterim = '';
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const result = event.results[i];
				const transcript = result[0]?.transcript?.trim();
				if (!transcript) continue;

				if (result.isFinal) {
					input = input ? `${input} ${transcript}`.trim() : transcript;
					lastInterim = '';
				} else {
					lastInterim = transcript;
				}
			}
			interimTranscript = lastInterim;
		};

		recognition.onerror = (event: { error: string }) => {
			if (event.error === 'aborted' || event.error === 'no-speech') return;
			if (event.error === 'not-allowed') {
				shouldBeListening = false;
				setVoiceError(
					'Microphone access was denied. Allow microphone for this site in your browser settings and try again.'
				);
				releaseMicrophone();
				stopWaveform();
				recognitionInstance = null;
				return;
			}
			voiceError = `Speech error: ${event.error}. Tap Resume to try again.`;
		};

		recognition.onend = () => {
			// Commit any in-flight interim text before the session closes.
			if (interimTranscript) {
				input = input ? `${input} ${interimTranscript}`.trim() : interimTranscript.trim();
				interimTranscript = '';
			}
			recognitionInstance = null;

			if (shouldBeListening) {
				// Chrome mobile fires onend after every utterance even with continuous:true.
				// Auto-restart to maintain the illusion of continuous recording.
				recognitionRestartTimer = setTimeout(() => {
					if (shouldBeListening) createAndStartRecognition();
				}, 150);
			} else {
				voiceState = 'paused';
			}
		};

		try {
			recognition.start();
		} catch {
			// start() can throw InvalidStateError if called too soon after a stop.
			recognitionRestartTimer = setTimeout(() => {
				if (shouldBeListening) createAndStartRecognition();
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

		shouldBeListening = true;
		voiceState = 'requesting';

		if (isMobile) {
			usedVoiceThisTurn = true;
			voiceState = 'listening';
			createAndStartRecognition();
			return;
		}

		navigator.mediaDevices
			.getUserMedia({ audio: true })
			.then((stream) => {
				if (!shouldBeListening) {
					stream.getTracks().forEach((t) => t.stop());
					return;
				}
				mediaStream = stream;

				const actx = new AudioContext();
				audioContext = actx;
				const source = actx.createMediaStreamSource(stream);
				const analyser = actx.createAnalyser();
				analyser.fftSize = 256;
				source.connect(analyser);
				analyserNode = analyser;

				usedVoiceThisTurn = true;
				voiceState = 'listening';
				createAndStartRecognition();
			})
			.catch((err: unknown) => {
				shouldBeListening = false;
				voiceState = 'idle';
				const name = err instanceof Error ? err.name : '';
				const message = err instanceof Error ? err.message : String(err);
				if (
					name === 'NotAllowedError' ||
					name === 'PermissionDeniedError' ||
					message.toLowerCase().includes('permission')
				) {
					voiceError =
						'Microphone access was denied. Allow microphone for this site and try again.';
					voiceState = 'denied';
				} else {
					voiceError =
						'Could not access microphone. Check that a microphone is connected and try again.';
					voiceState = 'denied';
				}
			});
	}

	function pauseVoice() {
		shouldBeListening = false;
		interimTranscript = '';
		stopRecognition();
		voiceState = 'paused';
	}

	function resumeVoice() {
		if (!isMobile && !mediaStream) return;
		voiceError = null;
		shouldBeListening = true;
		voiceState = 'listening';
		createAndStartRecognition();
	}

	function cancelVoice() {
		shouldBeListening = false;
		interimTranscript = '';
		stopRecognition();
		stopWaveform();
		releaseMicrophone();
		voiceState = 'idle';
		input = '';
	}

	function sendAndCloseVoice() {
		shouldBeListening = false;
		interimTranscript = '';
		stopRecognition();
		stopWaveform();
		releaseMicrophone();
		voiceState = 'idle';
		if (input.trim()) processInput();
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
		}
	});

	$effect(() => {
		const _state = voiceState;
		const canvas = waveformCanvas;
		const analyser = analyserNode;
		if ((_state === 'listening' || _state === 'paused') && canvas && analyser) {
			drawWaveform();
			return () => {
				if (waveformAnimationId != null) {
					cancelAnimationFrame(waveformAnimationId);
					waveformAnimationId = null;
				}
			};
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

	$effect(() => {
		return () => {
			if (!isOpen) cancelVoice();
		};
	});

	// ─── Actions ─────────────────────────────────────────────────────────────

	function handleClose() {
		cancelVoice();
		messages = [];
		onClose();
	}

	async function processInput() {
		if (!input.trim()) return;

		const userContent = input.trim();
		pushMessage({ role: 'user', content: userContent });
		input = '';
		isProcessing = true;

		try {
			const response = await fetch('/api/agent/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					prompt: userContent,
					context: usedVoiceThisTurn ? 'voice' : 'text',
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

			if (onSuccess) onSuccess();

			setTimeout(() => {
				if (isOpen) handleClose();
			}, 3000);
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
				<img src="/robot.png" alt="Mech" class="h-7 w-7" />
				<span class="flex-1 text-sm font-semibold tracking-wide text-gray-900 dark:text-white"
					>Mech</span
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
								<div class="flex items-start gap-2.5">
									<img src="/robot.png" alt="Mech" class="mt-0.5 h-6 w-6 flex-shrink-0" />
									<div
										class="max-w-[88%] rounded-2xl rounded-tl-sm border border-gray-100 bg-gray-50 px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
									>
										<div
											class="prose prose-sm prose-gray dark:prose-invert prose-p:my-1.5 prose-p:leading-relaxed prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-code:rounded prose-code:bg-gray-100 prose-code:px-1 prose-code:text-blue-600 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:text-gray-900 dark:prose-code:bg-gray-700 dark:prose-code:text-blue-400 dark:prose-headings:text-gray-100 max-w-none text-sm leading-relaxed text-gray-700 dark:text-gray-200"
										>
											{@html renderMarkdown(msg.content)}
										</div>
									</div>
								</div>
							{:else if msg.role === 'success'}
								<!-- Success bubble: left-aligned, green tint -->
								<div class="flex items-start gap-2.5">
									<div
										class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
									>
										<svg
											class="h-3.5 w-3.5 text-green-600 dark:text-green-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2.5"
												d="M5 13l4 4L19 7"
											></path>
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
									<img src="/robot.png" alt="Mech" class="mt-0.5 h-6 w-6 flex-shrink-0 opacity-60" />
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
								<img src="/robot.png" alt="Mech" class="mt-0.5 h-6 w-6 flex-shrink-0 opacity-60" />
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
						{#if pendingAction}
							<div class="flex items-start gap-2.5">
								<img src="/robot.png" alt="Mech" class="mt-0.5 h-6 w-6 flex-shrink-0" />
								<div
									class="w-full max-w-[88%] rounded-2xl rounded-tl-sm border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
								>
									<ActionConfirmation
										action={pendingAction}
										onConfirm={confirmAction}
										onCancel={cancelAction}
										{isConfirming}
									/>
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Footer: voice/text input (hidden when action pending) -->
			{#if !pendingAction}
				<footer
					class="flex-shrink-0 border-t border-gray-100 px-5 py-4 dark:border-gray-800"
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
					<div class="mb-3">
						{#if voiceState === 'idle' && voiceSupported}
							<button
								type="button"
								disabled={isProcessing}
								onclick={startVoiceInput}
								class="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/60 py-4 text-sm font-medium text-blue-700 transition-colors hover:border-blue-400 hover:bg-blue-100/60 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-900/10 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:bg-blue-900/20"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-4 w-4"
									fill="currentColor"
									viewBox="0 0 256 256"
								>
									<path
										d="M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0Zm40,143.6V240a8,8,0,0,1-16,0V207.6A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,128,0,8,8,0,0,1,16,0A80.11,80.11,0,0,1,136,207.6Z"
									></path>
								</svg>
								Tap to speak
							</button>
						{:else if voiceState === 'requesting'}
							<div
								class="flex w-full items-center justify-center gap-3 rounded-xl border border-blue-200 bg-blue-50/60 py-4 dark:border-blue-800 dark:bg-blue-900/10"
							>
								<div
									class="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
								></div>
								<span class="text-sm text-blue-700 dark:text-blue-300"
									>Getting microphone access…</span
								>
							</div>
						{:else if voiceState === 'listening' || voiceState === 'paused'}
							<div
								class="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
							>
								<div class="px-4 pt-3">
									{#if useWaveform}
										<canvas
											bind:this={waveformCanvas}
											class="h-12 w-full"
											aria-hidden="true"
											use:setupCanvas
										></canvas>
									{:else}
										<div
											class="flex h-12 items-center justify-center gap-1.5"
											aria-hidden="true"
										>
											{#each [0, 1, 2, 3, 4] as i}
												<span
													class="h-6 w-1 rounded-full bg-blue-400 animate-pulse dark:bg-blue-500"
													style="animation-delay: {i * 80}ms"
												></span>
											{/each}
										</div>
									{/if}
								</div>
								<div class="px-4 pb-1 pt-1.5">
									<p class="text-xs font-medium tracking-wide text-gray-400 dark:text-gray-500">
										{voiceState === 'listening' ? 'Listening…' : 'Paused'}
									</p>
									{#if input || interimTranscript}
										<p class="mt-0.5 text-sm leading-relaxed text-gray-800 dark:text-gray-200">
											{input}{input && interimTranscript ? ' ' : ''}<span
												class="text-gray-400 dark:text-gray-500">{interimTranscript}</span
											>
										</p>
									{:else}
										<p class="mt-0.5 text-sm italic text-gray-300 dark:text-gray-600">
											Say something…
										</p>
									{/if}
								</div>
								<div
									class="flex items-center justify-end gap-2 border-t border-gray-100 p-2.5 dark:border-gray-700"
								>
									{#if voiceState === 'listening'}
										<button
											type="button"
											onclick={pauseVoice}
											class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
										>
											Pause
										</button>
									{:else}
										<button
											type="button"
											onclick={resumeVoice}
											class="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
										>
											Resume
										</button>
									{/if}
									<button
										type="button"
										onclick={cancelVoice}
										class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
									>
										Cancel
									</button>
									<button
										type="button"
										disabled={!input.trim() && !interimTranscript.trim() || isProcessing}
										onclick={sendAndCloseVoice}
										class="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 dark:bg-blue-700 dark:hover:bg-blue-600"
									>
										Send
									</button>
								</div>
							</div>
						{:else if voiceState === 'unsupported' || voiceState === 'denied'}
							<!-- Fallback: show text input automatically when voice unavailable -->
						{/if}
					</div>

					<!-- Text fallback toggle -->
					<div>
						{#if voiceState !== 'unsupported' && voiceState !== 'denied' && voiceSupported && voiceState !== 'listening' && voiceState !== 'paused'}
							<button
								type="button"
								onclick={() => (textFallbackOpen = !textFallbackOpen)}
								class="mb-2 flex w-full items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
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
