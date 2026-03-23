<script lang="ts">
	import type { EquipmentResourceKind, EquipmentResourceExtractionStatus } from '$lib/types/db.js';
	import { EQUIPMENT_RESOURCE_KINDS } from '$lib/equipment-resource-upload.js';
	import { mechAssistantLaunch } from '$lib/stores/mechAssistantLaunch';

	type ResourceRow = {
		id: number;
		original_filename: string;
		mime_type: string;
		file_size: number;
		resource_kind: EquipmentResourceKind;
		title: string | null;
		notes: string | null;
		extraction_status: EquipmentResourceExtractionStatus;
		text_truncated: number;
		created_at: string;
		text_preview: string | null;
	};

	let { equipmentId }: { equipmentId: string } = $props();

	const kindLabels: Record<EquipmentResourceKind, string> = {
		owners_manual: "Owner's manual",
		service_manual: 'Service manual',
		repair_order: 'Repair order',
		invoice: 'Invoice',
		other: 'Other'
	};

	let resources = $state<ResourceRow[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let uploadError = $state('');
	let uploading = $state(false);
	let dragOver = $state(false);
	let fileInputEl: HTMLInputElement | null = $state(null);

	let editOpen = $state(false);
	let editing = $state<ResourceRow | null>(null);
	let editTitle = $state('');
	let editKind = $state<EquipmentResourceKind>('other');
	let editNotes = $state('');
	let savingEdit = $state(false);

	let deleteConfirmId = $state<number | null>(null);
	let reindexingId = $state<number | null>(null);

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function statusLabel(s: EquipmentResourceExtractionStatus): string {
		switch (s) {
			case 'pending':
				return 'Indexing…';
			case 'ok':
				return 'Indexed';
			case 'failed':
				return 'Index failed';
			case 'skipped':
				return 'No text extracted';
			default:
				return s;
		}
	}

	function statusClass(s: EquipmentResourceExtractionStatus): string {
		switch (s) {
			case 'ok':
				return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
			case 'pending':
				return 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100';
			case 'failed':
				return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
			default:
				return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
		}
	}

	function displayTitle(r: ResourceRow): string {
		return (r.title && r.title.trim()) || r.original_filename;
	}

	async function loadResources() {
		try {
			loading = true;
			loadError = '';
			const res = await fetch(`/api/equipment/${equipmentId}/resources`);
			if (!res.ok) throw new Error('Failed to load resources');
			resources = await res.json();
		} catch (e) {
			loadError = 'Could not load resources.';
			console.error(e);
		} finally {
			loading = false;
		}
	}

	async function uploadFile(file: File, resourceKind: EquipmentResourceKind, title: string) {
		uploadError = '';
		uploading = true;
		try {
			const fd = new FormData();
			fd.set('file', file);
			fd.set('resource_kind', resourceKind);
			if (title.trim()) fd.set('title', title.trim());
			const res = await fetch(`/api/equipment/${equipmentId}/resources`, {
				method: 'POST',
				body: fd
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				uploadError = data.error || 'Upload failed';
				return;
			}
			resources = [data, ...resources];
		} catch (e) {
			uploadError = 'Upload failed. Check your connection and try again.';
			console.error(e);
		} finally {
			uploading = false;
		}
	}

	function onFileSelected(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) uploadFile(file, 'other', '');
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) uploadFile(file, 'other', '');
	}

	function openEdit(r: ResourceRow) {
		editing = r;
		editTitle = r.title || '';
		editKind = r.resource_kind;
		editNotes = r.notes || '';
		editOpen = true;
	}

	function closeEdit() {
		editOpen = false;
		editing = null;
	}

	async function saveEdit() {
		if (!editing) return;
		savingEdit = true;
		try {
			const res = await fetch(`/api/equipment/${equipmentId}/resources/${editing.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: editTitle.trim() || null,
					resource_kind: editKind,
					notes: editNotes.trim() || null
				})
			});
			const data = await res.json();
			if (!res.ok) return;
			resources = resources.map((x) => (x.id === data.id ? data : x));
			closeEdit();
		} catch (e) {
			console.error(e);
		} finally {
			savingEdit = false;
		}
	}

	async function confirmDelete(id: number) {
		try {
			const res = await fetch(`/api/equipment/${equipmentId}/resources/${id}`, {
				method: 'DELETE'
			});
			if (!res.ok) return;
			resources = resources.filter((r) => r.id !== id);
		} catch (e) {
			console.error(e);
		} finally {
			deleteConfirmId = null;
		}
	}

	async function reextract(id: number) {
		reindexingId = id;
		try {
			const res = await fetch(`/api/equipment/${equipmentId}/resources/${id}/reextract`, {
				method: 'POST'
			});
			const data = await res.json();
			if (!res.ok) return;
			resources = resources.map((x) => (x.id === data.id ? data : x));
		} catch (e) {
			console.error(e);
		} finally {
			reindexingId = null;
		}
	}

	function openFileUrl(id: number) {
		window.open(
			`/api/equipment/${equipmentId}/resources/${id}/file`,
			'_blank',
			'noopener,noreferrer'
		);
	}

	function askMechAboutResources() {
		mechAssistantLaunch.set({
			prompt:
				'Using this equipment’s uploaded resources when helpful: summarize what documents are available, which to read first for routine maintenance, and anything important I should know.'
		});
	}

	$effect(() => {
		void equipmentId;
		loadResources();
	});
</script>

<div class="mx-auto max-w-7xl px-4 pb-16">
	<div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<p class="text-sm text-gray-600 dark:text-gray-400">
			Add manuals, invoices, and service docs so Mech can use them for managing this equipment.
		</p>
		<button
			type="button"
			class="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:bg-blue-600 dark:hover:bg-blue-500"
			onclick={askMechAboutResources}
		>
			Ask Mech about these files
		</button>
	</div>

	{#if uploadError}
		<div
			class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
			role="alert"
		>
			{uploadError}
		</div>
	{/if}

	<div
		role="region"
		aria-label="Upload resource file"
		class="mb-8 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors {dragOver
			? 'border-blue-500 bg-blue-50/80 dark:border-blue-400 dark:bg-blue-950/30'
			: 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900/40'}"
		ondragenter={(e) => {
			e.preventDefault();
			dragOver = true;
		}}
		ondragleave={() => (dragOver = false)}
		ondragover={(e) => e.preventDefault()}
		ondrop={onDrop}
	>
		<input
			bind:this={fileInputEl}
			type="file"
			class="sr-only"
			accept=".pdf,.doc,.docx,.txt,.md,.csv,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
			disabled={uploading}
			onchange={onFileSelected}
		/>
		<p class="text-sm font-medium text-gray-800 dark:text-gray-200">
			{uploading ? 'Uploading…' : 'Drop a file here or'}
		</p>
		<button
			type="button"
			class="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
			disabled={uploading}
			onclick={() => fileInputEl?.click()}
		>
			browse
		</button>
		<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
			PDF, Word, plain text, Markdown, CSV, RTF · max size uses server limit for resource uploads
		</p>
	</div>

	{#if loading}
		<div class="flex justify-center py-16 text-gray-500 dark:text-gray-400">Loading resources…</div>
	{:else if loadError}
		<div
			class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
		>
			{loadError}
			<button type="button" class="ms-2 font-semibold underline" onclick={loadResources}>
				Retry
			</button>
		</div>
	{:else if resources.length === 0}
		<div
			class="rounded-xl border border-gray-200 bg-gray-50/80 px-6 py-14 text-center dark:border-gray-700 dark:bg-gray-800/40"
		>
			<p class="text-base font-medium text-gray-800 dark:text-gray-100">No resources yet</p>
			<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
				Owner’s manuals and service PDFs help Mech give accurate specs and procedures for this item.
			</p>
		</div>
	{:else}
		<ul
			class="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700"
		>
			{#each resources as r (r.id)}
				<li
					class="flex flex-col gap-3 bg-white px-4 py-4 sm:flex-row sm:items-start sm:justify-between dark:bg-gray-900/30"
				>
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-2">
							<span class="font-medium text-gray-900 dark:text-white">{displayTitle(r)}</span>
							<span
								class="rounded-full px-2 py-0.5 text-xs font-medium {statusClass(
									r.extraction_status
								)}"
							>
								{statusLabel(r.extraction_status)}
							</span>
							<span
								class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
							>
								{kindLabels[r.resource_kind]}
							</span>
						</div>
						<p class="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
							{r.original_filename} · {formatFileSize(r.file_size)}
						</p>
						{#if r.notes}
							<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{r.notes}</p>
						{/if}
						{#if r.text_preview && r.extraction_status === 'ok'}
							<p class="mt-2 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
								{r.text_preview}
							</p>
						{/if}
					</div>
					<div class="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
						<button
							type="button"
							class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
							onclick={() => openFileUrl(r.id)}
						>
							Open
						</button>
						<button
							type="button"
							class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
							onclick={() => openEdit(r)}
						>
							Edit
						</button>
						{#if r.extraction_status === 'failed' || r.extraction_status === 'skipped'}
							<button
								type="button"
								class="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-950/50"
								disabled={reindexingId === r.id}
								onclick={() => reextract(r.id)}
							>
								{reindexingId === r.id ? 'Retrying…' : 'Retry index'}
							</button>
						{/if}
						<button
							type="button"
							class="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
							onclick={() => (deleteConfirmId = r.id)}
						>
							Delete
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

{#if deleteConfirmId !== null}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="del-res-title"
	>
		<div
			class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900 dark:ring-1 dark:ring-gray-700"
		>
			<h2 id="del-res-title" class="text-lg font-semibold text-gray-900 dark:text-white">
				Delete resource?
			</h2>
			<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
				This removes the file from storage and cannot be undone.
			</p>
			<div class="mt-6 flex justify-end gap-2">
				<button
					type="button"
					class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
					onclick={() => (deleteConfirmId = null)}
				>
					Cancel
				</button>
				<button
					type="button"
					class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
					onclick={() => confirmDelete(deleteConfirmId!)}
				>
					Delete
				</button>
			</div>
		</div>
	</div>
{/if}

{#if editOpen && editing}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="edit-res-title"
	>
		<div
			class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900 dark:ring-1 dark:ring-gray-700"
		>
			<h2 id="edit-res-title" class="text-lg font-semibold text-gray-900 dark:text-white">
				Edit resource
			</h2>
			<div class="mt-4 space-y-4">
				<div>
					<label for="res-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300"
						>Title</label
					>
					<input
						id="res-title"
						type="text"
						class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
						bind:value={editTitle}
						placeholder={editing.original_filename}
					/>
				</div>
				<div>
					<label for="res-kind" class="block text-sm font-medium text-gray-700 dark:text-gray-300"
						>Kind</label
					>
					<select
						id="res-kind"
						class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
						bind:value={editKind}
					>
						{#each EQUIPMENT_RESOURCE_KINDS as k (k)}
							<option value={k}>{kindLabels[k]}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="res-notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300"
						>Notes</label
					>
					<textarea
						id="res-notes"
						rows="3"
						class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
						bind:value={editNotes}
					></textarea>
				</div>
			</div>
			<div class="mt-6 flex justify-end gap-2">
				<button
					type="button"
					class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
					onclick={closeEdit}
				>
					Cancel
				</button>
				<button
					type="button"
					class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
					disabled={savingEdit}
					onclick={saveEdit}
				>
					{savingEdit ? 'Saving…' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}
