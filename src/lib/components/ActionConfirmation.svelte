<script lang="ts">
	import { onMount } from 'svelte';

	interface ActionResult {
		type: 'create' | 'update' | 'delete' | 'query';
		entity: 'equipment' | 'task' | 'task_batch' | 'maintenance_log';
		data?: any;
		confirmation_message?: string;
	}

	interface Props {
		action: ActionResult;
		onConfirm: (updatedData?: any, userFeedback?: string) => void;
		onCancel: () => void;
		isConfirming?: boolean;
	}

	const { action, onConfirm, onCancel, isConfirming = false }: Props = $props();

	const FIELDS_PANEL_ID = 'action-confirm-fields';

	let equipmentTypes = $state<Array<{ id: number; name: string }>>([]);
	let taskTypes = $state<Array<{ id: number; name: string }>>([]);
	let isLoading = $state(true);

	let editedData = $state<any>({});
	let userFeedback = $state('');
	let dataSnapshot = $state<string | null>(null);
	let detailsOpen = $state(false);

	const controlClass =
		'w-full min-w-0 max-w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-900/40 dark:text-white dark:focus:border-blue-400';
	const readOnlyClass =
		'block max-w-full min-w-0 break-words rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900 dark:bg-gray-700/80 dark:text-white';

	onMount(async () => {
		try {
			const [equipmentTypesRes, taskTypesRes] = await Promise.all([
				fetch('/api/equipment-types'),
				fetch('/api/task-types')
			]);

			if (equipmentTypesRes.ok) {
				equipmentTypes = await equipmentTypesRes.json();
			}

			if (taskTypesRes.ok) {
				taskTypes = await taskTypesRes.json();
			}
		} catch (error) {
			console.warn('Failed to fetch reference data:', error);
		} finally {
			isLoading = false;
		}
	});

	$effect(() => {
		if (action.data) {
			const enhancedData = getEnhancedData(action.data, action.entity);
			editedData = structuredClone(enhancedData);
			dataSnapshot = JSON.stringify(enhancedData);
		}
	});

	function isDirty(): boolean {
		return dataSnapshot !== null && JSON.stringify(editedData) !== dataSnapshot;
	}

	function formatEntityLabel(entity: string): string {
		return entity.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
	}

	function getActionTitle(): string {
		const t = action.type.charAt(0).toUpperCase() + action.type.slice(1);
		return `${t} ${formatEntityLabel(action.entity)}`;
	}

	function flatPayloadForSummary(data: any): Record<string, any> {
		if (!data || typeof data !== 'object') return {};
		if (data.updates && typeof data.updates === 'object') {
			return { ...data, ...data.updates };
		}
		return data;
	}

	function deriveSummaryFromEditedData(): string {
		const d = flatPayloadForSummary(editedData);
		switch (action.entity) {
			case 'equipment': {
				const bits: string[] = [];
				if (d.name) bits.push(String(d.name));
				if (d.make || d.model) bits.push([d.make, d.model].filter(Boolean).join(' '));
				if (d.year != null && d.year !== '') bits.push(String(d.year));
				return bits.join(' · ') || 'Equipment';
			}
			case 'task': {
				return d.title ? String(d.title) : 'Task';
			}
			case 'task_batch': {
				const n = Array.isArray(d.tasks) ? d.tasks.length : 0;
				return n ? `${n} proposed task${n === 1 ? '' : 's'}` : 'Task batch';
			}
			case 'maintenance_log': {
				if (d.notes && String(d.notes).trim()) {
					const n = String(d.notes).trim();
					return n.length > 100 ? `${n.slice(0, 97)}…` : n;
				}
				if (d.task_id != null) return `Maintenance log (task #${d.task_id})`;
				return 'Maintenance log';
			}
			default:
				return '';
		}
	}

	function getSummaryText(): string {
		const msg = action.confirmation_message?.trim();
		if (msg && !isDirty()) return msg;
		return deriveSummaryFromEditedData();
	}

	function resolveValue(key: string, value: any): any {
		if (key === 'equipment_type_id' && typeof value === 'number') {
			const equipmentType = equipmentTypes.find((type) => type.id === value);
			return equipmentType ? equipmentType.name : 'Unknown Type';
		}

		if (key === 'task_type_id' && typeof value === 'number') {
			const taskType = taskTypes.find((type) => type.id === value);
			return taskType ? taskType.name : 'Unknown Task Type';
		}

		if (Array.isArray(value)) {
			return value.join(', ');
		}

		if (typeof value === 'object' && value !== null) {
			return JSON.stringify(value);
		}

		return value;
	}

	function formatFieldName(key: string): string {
		switch (key) {
			case 'equipment_type_id':
				return 'Equipment Type';
			case 'task_type_id':
				return 'Task Type';
			case 'current_usage_value':
				return 'Current Usage';
			case 'usage_unit':
				return 'Usage Unit';
			case 'serial_number':
				return 'Identifier (e.g Serial Number, Rego Plate)';
			case 'purchase_date':
				return 'Purchase Date';
			case 'time_interval_days':
				return 'Time Interval (Days)';
			case 'usage_interval':
				return 'Usage Interval';
			default:
				return key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
		}
	}

	function formatData(
		data: any
	): Array<{ key: string; value: any; fieldKey: string; editable: boolean }> {
		if (!data) return [];

		const enhancedData = getEnhancedData(data, action.entity);
		const formatted: Array<{ key: string; value: any; fieldKey: string; editable: boolean }> = [];

		for (const [key, value] of Object.entries(enhancedData || {})) {
			if (
				key === 'id' ||
				key === 'metadata' ||
				key === 'tags' ||
				key === 'created_at' ||
				key === 'updated_at'
			)
				continue;

			if (key === 'updates' && typeof value === 'object' && value !== null) {
				for (const [updateKey, updateValue] of Object.entries(value)) {
					if (
						updateKey === 'metadata' ||
						updateKey === 'tags' ||
						updateKey === 'created_at' ||
						updateKey === 'updated_at'
					)
						continue;

					formatted.push({
						key: formatFieldName(updateKey),
						value: resolveValue(updateKey, updateValue),
						fieldKey: updateKey,
						editable: isFieldEditable(updateKey)
					});
				}
			} else {
				formatted.push({
					key: formatFieldName(key),
					value: resolveValue(key, value),
					fieldKey: key,
					editable: isFieldEditable(key)
				});
			}
		}

		return formatted;
	}

	function isFieldEditable(fieldKey: string): boolean {
		const editableFields = [
			'name',
			'make',
			'model',
			'year',
			'serial_number',
			'purchase_date',
			'current_usage_value',
			'usage_unit',
			'equipment_type_id',
			'title',
			'description',
			'priority',
			'time_interval_days',
			'usage_interval',
			'equipment_id',
			'task_type_id',
			'status',
			'cost',
			'service_provider',
			'notes',
			'completed_date',
			'completed_usage_value',
			'task_id',
			'parts_used'
		];

		return editableFields.includes(fieldKey);
	}

	function getInputType(
		fieldKey: string,
		value: any
	): 'text' | 'number' | 'date' | 'select' | 'textarea' | 'parts_array' {
		if (fieldKey === 'parts_used') {
			return 'parts_array';
		}

		if (
			fieldKey.includes('date') ||
			fieldKey === 'purchase_date' ||
			fieldKey === 'completed_date'
		) {
			return 'date';
		}

		if (fieldKey === 'description' || fieldKey === 'notes') {
			return 'textarea';
		}

		if (
			fieldKey === 'equipment_type_id' ||
			fieldKey === 'task_type_id' ||
			fieldKey === 'priority' ||
			fieldKey === 'usage_unit' ||
			fieldKey === 'status'
		) {
			return 'select';
		}

		if (
			fieldKey === 'year' ||
			fieldKey === 'current_usage_value' ||
			fieldKey === 'time_interval_days' ||
			fieldKey === 'usage_interval' ||
			fieldKey === 'cost' ||
			fieldKey === 'completed_usage_value' ||
			fieldKey === 'equipment_id' ||
			fieldKey === 'task_id' ||
			typeof value === 'number'
		) {
			return 'number';
		}

		return 'text';
	}

	function isFullWidthField(fieldKey: string, inputType: string): boolean {
		return (
			inputType === 'textarea' ||
			inputType === 'parts_array' ||
			fieldKey === 'description' ||
			fieldKey === 'notes'
		);
	}

	function fieldDomId(fieldKey: string): string {
		return `acf-${fieldKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
	}

	function getPartsArray(partsUsed: any): string[] {
		if (!partsUsed) return [];
		if (typeof partsUsed === 'string') {
			try {
				const parsed = JSON.parse(partsUsed);
				return Array.isArray(parsed) ? parsed : [];
			} catch {
				return partsUsed ? [partsUsed] : [];
			}
		}
		if (Array.isArray(partsUsed)) return partsUsed;
		return [];
	}

	function setPartsArray(parts: string[]) {
		updateField('parts_used', JSON.stringify(parts));
	}

	function addPart() {
		const currentParts = getPartsArray(editedData.parts_used);
		setPartsArray([...currentParts, '']);
	}

	function removePart(index: number) {
		const currentParts = getPartsArray(editedData.parts_used);
		setPartsArray(currentParts.filter((_, i) => i !== index));
	}

	function updatePart(index: number, value: string) {
		const currentParts = getPartsArray(editedData.parts_used);
		currentParts[index] = value;
		setPartsArray(currentParts);
	}

	function getEquipmentTemplate() {
		return {
			name: '',
			equipment_type_id: 1,
			make: '',
			model: '',
			year: new Date().getFullYear(),
			serial_number: '',
			purchase_date: '',
			current_usage_value: 0,
			usage_unit: 'km'
		};
	}

	function getTaskTemplate() {
		return {
			title: '',
			description: '',
			equipment_id: null,
			task_type_id: 1,
			priority: 'medium',
			time_interval_days: null,
			usage_interval: null,
			status: 'pending'
		};
	}

	function getMaintenanceLogTemplate() {
		return {
			task_id: null,
			equipment_id: null,
			completed_date: new Date().toISOString().split('T')[0],
			completed_usage_value: null,
			notes: '',
			cost: null,
			parts_used: JSON.stringify([]),
			service_provider: ''
		};
	}

	function getEnhancedData(data: any, entity: string) {
		if (entity === 'equipment' && action.type === 'create') {
			const template = getEquipmentTemplate();
			return { ...template, ...data };
		} else if (entity === 'task_batch' && action.type === 'create') {
			return structuredClone(data);
		} else if (entity === 'task' && action.type === 'create') {
			const template = getTaskTemplate();
			return { ...template, ...data };
		} else if (entity === 'maintenance_log' && action.type === 'create') {
			const template = getMaintenanceLogTemplate();
			return { ...template, ...data };
		}
		return data;
	}

	function handleConfirm() {
		const hasChanges = JSON.stringify(editedData) !== JSON.stringify(action.data);
		const hasFeedback = userFeedback.trim().length > 0;

		if (hasChanges || hasFeedback) {
			onConfirm(editedData, userFeedback.trim() || undefined);
		} else {
			onConfirm();
		}
	}

	function updateField(fieldKey: string, value: any) {
		if (action.data?.updates) {
			if (fieldKey in action.data.updates) {
				editedData.updates[fieldKey] = value;
			} else {
				editedData[fieldKey] = value;
			}
		} else {
			editedData[fieldKey] = value;
		}
	}

	function taskBatchCadenceLine(task: Record<string, unknown>): string {
		const typeLabel =
			typeof task.task_type_id === 'number'
				? String(resolveValue('task_type_id', task.task_type_id))
				: '';
		const parts: string[] = [];
		if (typeLabel) parts.push(typeLabel);
		if (task.time_interval_days != null) parts.push(`every ${task.time_interval_days} days`);
		if (task.usage_interval != null) parts.push(`every ${task.usage_interval} usage units`);
		if (task.priority) parts.push(String(task.priority));
		return parts.join(' · ');
	}

	function taskTypeNameById(id: number): string {
		const t = taskTypes.find((x) => x.id === id);
		return t ? t.name : `#${id}`;
	}
</script>

<article class="flex max-w-full min-w-0 flex-col gap-3 font-sans text-gray-900 dark:text-gray-100">
	<header class="min-w-0 space-y-1.5">
		<div class="flex flex-wrap items-center gap-2">
			<h3 class="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">
				{getActionTitle()}
			</h3>
			{#if isDirty()}
				<span
					class="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-amber-900 uppercase dark:bg-amber-900/40 dark:text-amber-200"
				>
					Edited
				</span>
			{/if}
		</div>
		<p
			class="line-clamp-4 text-sm leading-snug break-words text-gray-600 dark:text-gray-300"
			title={getSummaryText()}
		>
			{getSummaryText()}
		</p>
	</header>

	{#if !detailsOpen}
		<button
			type="button"
			class="flex w-full min-w-0 items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-200 py-2 text-xs font-medium text-blue-600 transition-colors hover:border-blue-300 hover:bg-blue-50/80 dark:border-gray-600 dark:text-blue-400 dark:hover:border-blue-500 dark:hover:bg-blue-950/30"
			onclick={() => (detailsOpen = true)}
			aria-expanded="false"
			aria-controls={FIELDS_PANEL_ID}
		>
			<svg
				class="h-4 w-4 shrink-0"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
				/>
			</svg>
			{action.entity === 'task_batch' ? 'View proposed tasks' : 'Edit details'}
		</button>
	{/if}

	{#if detailsOpen}
		<div
			id={FIELDS_PANEL_ID}
			class="flex min-w-0 flex-col gap-3 border-t border-gray-200/80 pt-3 dark:border-gray-700/80"
			role="region"
			aria-label="Action fields"
		>
			<div class="flex items-center justify-between gap-2">
				<span class="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400"
					>{action.entity === 'task_batch' ? 'Proposed tasks' : 'Details'}</span
				>
				<button
					type="button"
					class="text-xs font-medium text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline dark:text-gray-400 dark:hover:text-gray-200"
					onclick={() => (detailsOpen = false)}
					aria-expanded="true"
					aria-controls={FIELDS_PANEL_ID}
				>
					Hide details
				</button>
			</div>

			{#if action.entity === 'task_batch' && action.data && Array.isArray(action.data.tasks) && !isLoading}
				<div
					class="scrollbar-hidden max-h-[min(50vh,18rem)] min-w-0 space-y-3 overflow-x-hidden overflow-y-auto pr-0.5 text-sm"
				>
					<ul class="list-inside list-decimal space-y-4 text-gray-800 dark:text-gray-200">
						{#each action.data.tasks as task, i (`batch-task-${i}`)}
							<li class="pl-1">
								<div class="font-medium break-words text-gray-900 dark:text-gray-100">
									{task.title != null ? String(task.title) : 'Task'}
								</div>
								<div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
									{taskBatchCadenceLine(task)}
								</div>
								{#if task.description != null && String(task.description).trim()}
									<p
										class="mt-1.5 max-h-32 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap text-gray-600 dark:text-gray-300"
									>
										{String(task.description).trim()}
									</p>
								{/if}
							</li>
						{/each}
					</ul>
					{#if action.data.skipped_duplicate_task_type_ids?.length}
						<p class="text-xs text-gray-600 dark:text-gray-400">
							Skipped (already on this equipment):
							{action.data.skipped_duplicate_task_type_ids.map(taskTypeNameById).join(', ')}.
						</p>
					{/if}
					{#if action.data.skipped_unresolved_type_names?.length}
						<p class="text-xs text-amber-800 dark:text-amber-200/90">
							Not in your task types list (skipped):
							{action.data.skipped_unresolved_type_names.join(', ')}.
						</p>
					{/if}
				</div>
			{:else if action.data && !isLoading}
				<div
					class="scrollbar-hidden max-h-[min(50vh,18rem)] min-w-0 overflow-x-hidden overflow-y-auto pr-0.5"
				>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						{#each formatData(action.data) as item (item.fieldKey)}
							{@const inputType = item.editable ? getInputType(item.fieldKey, item.value) : 'text'}
							{@const full = isFullWidthField(item.fieldKey, inputType)}
							<div class="flex min-w-0 flex-col gap-1.5 {full ? 'sm:col-span-2' : ''}">
								<label
									class="text-[11px] font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400"
									for={fieldDomId(item.fieldKey)}
								>
									{item.key}
								</label>
								{#if item.editable}
									{#if inputType === 'select'}
										{#if item.fieldKey === 'equipment_type_id'}
											<select
												id={fieldDomId(item.fieldKey)}
												value={editedData[item.fieldKey]}
												onchange={(e) =>
													updateField(
														item.fieldKey,
														parseInt((e.target as HTMLSelectElement).value)
													)}
												class={controlClass}
											>
												{#each equipmentTypes as type (type.id)}
													<option value={type.id}>{type.name}</option>
												{/each}
											</select>
										{:else if item.fieldKey === 'task_type_id'}
											<select
												id={fieldDomId(item.fieldKey)}
												value={editedData[item.fieldKey]}
												onchange={(e) =>
													updateField(
														item.fieldKey,
														parseInt((e.target as HTMLSelectElement).value)
													)}
												class={controlClass}
											>
												{#each taskTypes as type (type.id)}
													<option value={type.id}>{type.name}</option>
												{/each}
											</select>
										{:else if item.fieldKey === 'priority'}
											<select
												id={fieldDomId(item.fieldKey)}
												value={editedData[item.fieldKey]}
												onchange={(e) =>
													updateField(item.fieldKey, (e.target as HTMLSelectElement).value)}
												class={controlClass}
											>
												<option value="low">Low</option>
												<option value="medium">Medium</option>
												<option value="high">High</option>
												<option value="critical">Critical</option>
											</select>
										{:else if item.fieldKey === 'status'}
											<select
												id={fieldDomId(item.fieldKey)}
												value={editedData[item.fieldKey]}
												onchange={(e) =>
													updateField(item.fieldKey, (e.target as HTMLSelectElement).value)}
												class={controlClass}
											>
												<option value="pending">Pending</option>
												<option value="completed">Completed</option>
												<option value="overdue">Overdue</option>
											</select>
										{:else if item.fieldKey === 'usage_unit'}
											<select
												id={fieldDomId(item.fieldKey)}
												value={editedData[item.fieldKey]}
												onchange={(e) =>
													updateField(item.fieldKey, (e.target as HTMLSelectElement).value)}
												class={controlClass}
											>
												<option value="km">Kilometers</option>
												<option value="miles">Miles</option>
												<option value="hours">Hours</option>
												<option value="cycles">Cycles</option>
												<option value="days">Days</option>
											</select>
										{/if}
									{:else if inputType === 'parts_array'}
										{@const partsArray = getPartsArray(editedData[item.fieldKey])}
										<div class="space-y-2">
											{#each partsArray as part, index (`${item.fieldKey}-${index}`)}
												<div class="flex min-w-0 items-center gap-2">
													<input
														id={index === 0 ? fieldDomId(item.fieldKey) : undefined}
														type="text"
														value={part}
														oninput={(e) => updatePart(index, (e.target as HTMLInputElement).value)}
														placeholder="Part name"
														class="{controlClass} flex-1"
													/>
													<button
														type="button"
														onclick={() => removePart(index)}
														class="shrink-0 p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
														aria-label="Remove part"
														title="Remove part"
													>
														<svg
															class="h-4 w-4"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M6 18L18 6M6 6l12 12"
															></path>
														</svg>
													</button>
												</div>
											{/each}
											<button
												type="button"
												onclick={addPart}
												class="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
											>
												<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M12 6v6m0 0v6m0-6h6m-6 0H6"
													></path>
												</svg>
												Add part
											</button>
										</div>
									{:else if inputType === 'textarea'}
										<textarea
											id={fieldDomId(item.fieldKey)}
											value={editedData[item.fieldKey] || ''}
											oninput={(e) =>
												updateField(item.fieldKey, (e.target as HTMLTextAreaElement).value)}
											rows="3"
											class="{controlClass} resize-y"
										></textarea>
									{:else if inputType === 'date'}
										<input
											id={fieldDomId(item.fieldKey)}
											type="date"
											value={editedData[item.fieldKey] || ''}
											oninput={(e) =>
												updateField(item.fieldKey, (e.target as HTMLInputElement).value)}
											class={controlClass}
										/>
									{:else if inputType === 'number'}
										<input
											id={fieldDomId(item.fieldKey)}
											type="number"
											min={item.fieldKey === 'year' ? '1900' : '0'}
											max={item.fieldKey === 'year'
												? (new Date().getFullYear() + 1).toString()
												: undefined}
											step={item.fieldKey === 'cost' ? '0.01' : '1'}
											value={editedData[item.fieldKey] ?? ''}
											oninput={(e) => {
												const raw = (e.target as HTMLInputElement).value;
												const numValue =
													item.fieldKey === 'cost' ? parseFloat(raw) : parseInt(raw, 10);
												updateField(item.fieldKey, isNaN(numValue) ? null : numValue);
											}}
											class={controlClass}
										/>
									{:else}
										<input
											id={fieldDomId(item.fieldKey)}
											type="text"
											value={editedData[item.fieldKey] ?? ''}
											oninput={(e) =>
												updateField(item.fieldKey, (e.target as HTMLInputElement).value)}
											class={controlClass}
										/>
									{/if}
								{:else}
									<span
										id={fieldDomId(item.fieldKey)}
										class="{readOnlyClass} block overflow-x-auto font-mono text-xs"
									>
										{item.value}
									</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{:else if isLoading}
				<div class="flex justify-center py-2">
					<span class="text-sm text-gray-500 dark:text-gray-400">Loading details…</span>
				</div>
			{:else if action.entity === 'task_batch'}
				<p class="text-sm text-gray-500 dark:text-gray-400">No task list available.</p>
			{/if}

			<div class="min-w-0">
				<label
					class="mb-1.5 block text-[11px] font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400"
					for="acf-user-feedback"
				>
					Instructions (optional)
				</label>
				<textarea
					id="acf-user-feedback"
					bind:value={userFeedback}
					placeholder="Any extra context for this action…"
					rows="2"
					class="{controlClass} resize-none"
				></textarea>
			</div>
		</div>
	{/if}

	<footer
		class="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-gray-200/80 pt-3 dark:border-gray-700/80"
	>
		<button
			type="button"
			onclick={onCancel}
			disabled={isConfirming}
			class="min-h-[2.25rem] rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
		>
			Cancel
		</button>
		<button
			type="button"
			onclick={handleConfirm}
			disabled={isConfirming}
			class="min-h-[2.25rem] rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
		>
			{isConfirming ? 'Confirming…' : 'Confirm'}
		</button>
	</footer>
</article>
