<script lang="ts">
  import { onMount } from 'svelte';

  interface ActionResult {
    type: 'create' | 'update' | 'delete' | 'query';
    entity: 'equipment' | 'task' | 'maintenance_log';
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

  // State for lookup data
  let equipmentTypes = $state<Array<{id: number, name: string}>>([]);
  let taskTypes = $state<Array<{id: number, name: string}>>([]);
  let isLoading = $state(true);

  // State for editing
  let editedData = $state<any>({});
  let userFeedback = $state('');
  let isEditing = $state(false);

  // Fetch reference data on mount
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

  // Initialize edited data when action changes
  $effect(() => {
    if (action.data) {
      const enhancedData = getEnhancedData(action.data, action.entity);
      editedData = structuredClone(enhancedData);
    }
  });

  function resolveValue(key: string, value: any): any {
    // Resolve equipment_type_id to equipment type name
    if (key === 'equipment_type_id' && typeof value === 'number') {
      const equipmentType = equipmentTypes.find(type => type.id === value);
      return equipmentType ? equipmentType.name : 'Unknown Type';
    }
    
    // Resolve task_type_id to task type name
    if (key === 'task_type_id' && typeof value === 'number') {
      const taskType = taskTypes.find(type => type.id === value);
      return taskType ? taskType.name : 'Unknown Task Type';
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    
    // Handle objects
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    
    return value;
  }

  function formatFieldName(key: string): string {
    // Convert snake_case to proper labels
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
        return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }

  function formatData(data: any): Array<{ key: string; value: any; fieldKey: string; editable: boolean }> {
    if (!data) return [];
    
    // Use enhanced data that includes all relevant fields for creation
    const enhancedData = getEnhancedData(data, action.entity);
    const formatted: Array<{ key: string; value: any; fieldKey: string; editable: boolean }> = [];
    
    for (const [key, value] of Object.entries(enhancedData || {})) {
      // Skip internal/system fields that shouldn't be shown in UI
      if (key === 'id' || key === 'metadata' || key === 'tags' || key === 'created_at' || key === 'updated_at') continue;
      
      // Handle nested updates object
      if (key === 'updates' && typeof value === 'object' && value !== null) {
        for (const [updateKey, updateValue] of Object.entries(value)) {
          // Skip internal fields in updates too
          if (updateKey === 'metadata' || updateKey === 'tags' || updateKey === 'created_at' || updateKey === 'updated_at') continue;
          
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
    // Fields that should be editable
    const editableFields = [
      // Equipment fields
      'name', 'make', 'model', 'year', 'serial_number', 'purchase_date', 
      'current_usage_value', 'usage_unit', 'equipment_type_id',
      // Task fields  
      'title', 'description', 'priority', 'time_interval_days', 'usage_interval',
      'equipment_id', 'task_type_id', 'status',
      // Maintenance log fields
      'cost', 'service_provider', 'notes', 'completed_date', 'completed_usage_value',
      'task_id', 'parts_used'
    ];
    
    return editableFields.includes(fieldKey);
  }

  function getInputType(fieldKey: string, value: any): 'text' | 'number' | 'date' | 'select' | 'textarea' | 'parts_array' {
    // Parts array special handling
    if (fieldKey === 'parts_used') {
      return 'parts_array';
    }
    
    // Date fields
    if (fieldKey.includes('date') || fieldKey === 'purchase_date' || fieldKey === 'completed_date') {
      return 'date';
    }
    
    // Textarea fields
    if (fieldKey === 'description' || fieldKey === 'notes') {
      return 'textarea';
    }
    
    // Select/dropdown fields
    if (fieldKey === 'equipment_type_id' || fieldKey === 'task_type_id' || 
        fieldKey === 'priority' || fieldKey === 'usage_unit' || fieldKey === 'status') {
      return 'select';
    }
    
    // Number fields based on database schema
    if (fieldKey === 'year' || fieldKey === 'current_usage_value' || 
        fieldKey === 'time_interval_days' || fieldKey === 'usage_interval' ||
        fieldKey === 'cost' || fieldKey === 'completed_usage_value' ||
        fieldKey === 'equipment_id' || fieldKey === 'task_id' ||
        typeof value === 'number') {
      return 'number';
    }
    
    // Default to text
    return 'text';
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
      // For equipment creation, show all relevant fields even if not populated
      const template = getEquipmentTemplate();
      return { ...template, ...data };
    } else if (entity === 'task' && action.type === 'create') {
      // For task creation, show all relevant fields even if not populated  
      const template = getTaskTemplate();
      return { ...template, ...data };
    } else if (entity === 'maintenance_log' && action.type === 'create') {
      // For maintenance log creation, show all relevant fields
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
      // Handle nested updates structure
      if (fieldKey in action.data.updates) {
        editedData.updates[fieldKey] = value;
      } else {
        editedData[fieldKey] = value;
      }
    } else {
      editedData[fieldKey] = value;
    }
  }
</script>

<!-- Assistant's confirmation message -->
<div class="mb-4 flex items-start gap-3 max-h-[50vh] overflow-y-auto scrollbar-hidden">
  <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
    <img src="/robot.png" alt="assistant" class="w-5 h-5">
  </div>
  <div class="max-w-sm bg-gray-50 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700">
    <div class="flex items-center gap-2 mb-2">
      <span class="text-sm font-medium text-gray-900 dark:text-white capitalize">
        {action.type} {action.entity.replace('_', ' ')}
      </span>
    </div>
    <p class="text-sm text-gray-700 dark:text-gray-300 mb-3">
      {action.confirmation_message || `I'll ${action.type} this ${action.entity.replace('_', ' ')} with the details below. Feel free to edit any values or add additional instructions.`}
    </p>
    
    {#if action.data && !isLoading}
      <div class="space-y-2 mb-3">
        {#each formatData(action.data) as item}
          <div class="flex flex-col gap-1">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="text-xs font-medium text-gray-600 dark:text-gray-400">
              {item.key}
            </label>
{#if item.editable}
              {@const inputType = getInputType(item.fieldKey, item.value)}
              
              {#if inputType === 'select'}
                {#if item.fieldKey === 'equipment_type_id'}
                  <select 
                    value={editedData[item.fieldKey]}
                    onchange={(e) => updateField(item.fieldKey, parseInt((e.target as HTMLSelectElement).value))}
                    class="text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white"
                  >
                    {#each equipmentTypes as type}
                      <option value={type.id}>{type.name}</option>
                    {/each}
                  </select>
                {:else if item.fieldKey === 'task_type_id'}
                  <select 
                    value={editedData[item.fieldKey]}
                    onchange={(e) => updateField(item.fieldKey, parseInt((e.target as HTMLSelectElement).value))}
                    class="text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white"
                  >
                    {#each taskTypes as type}
                      <option value={type.id}>{type.name}</option>
                    {/each}
                  </select>
                {:else if item.fieldKey === 'priority'}
                  <select 
                    value={editedData[item.fieldKey]}
                    onchange={(e) => updateField(item.fieldKey, (e.target as HTMLSelectElement).value)}
                    class="text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                {:else if item.fieldKey === 'status'}
                  <select 
                    value={editedData[item.fieldKey]}
                    onchange={(e) => updateField(item.fieldKey, (e.target as HTMLSelectElement).value)}
                    class="text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white"
                  >
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="overdue">Overdue</option>
                  </select>
                {:else if item.fieldKey === 'usage_unit'}
                  <select 
                    value={editedData[item.fieldKey]}
                    onchange={(e) => updateField(item.fieldKey, (e.target as HTMLSelectElement).value)}
                    class="text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white"
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
                  {#each partsArray as part, index}
                    <div class="flex gap-2 items-center">
                      <input 
                        type="text" 
                        value={part}
                        oninput={(e) => updatePart(index, (e.target as HTMLInputElement).value)}
                        placeholder="Part name"
                        class="flex-1 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white"
                      />
                      <button 
                        type="button"
                        onclick={() => removePart(index)}
                        class="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                        aria-label="Remove part"
                        title="Remove part"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                      </button>
                    </div>
                  {/each}
                  <button 
                    type="button"
                    onclick={addPart}
                    class="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    Add part
                  </button>
                </div>
              {:else if inputType === 'textarea'}
                <textarea 
                  value={editedData[item.fieldKey] || ''}
                  oninput={(e) => updateField(item.fieldKey, (e.target as HTMLTextAreaElement).value)}
                  rows="3"
                  class="text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white resize-none"
                ></textarea>
              {:else if inputType === 'date'}
                <input 
                  type="date" 
                  value={editedData[item.fieldKey] || ''}
                  oninput={(e) => updateField(item.fieldKey, (e.target as HTMLInputElement).value)}
                  class="text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white"
                />
              {:else if inputType === 'number'}
                <input 
                  type="number" 
                  min={item.fieldKey === 'year' ? '1900' : '0'}
                  max={item.fieldKey === 'year' ? (new Date().getFullYear() + 1).toString() : undefined}
                  step={item.fieldKey === 'cost' ? '0.01' : '1'}
                  value={editedData[item.fieldKey] || ''}
                  oninput={(e) => {
                    const value = (e.target as HTMLInputElement).value;
                    const numValue = item.fieldKey === 'cost' ? parseFloat(value) : parseInt(value);
                    updateField(item.fieldKey, isNaN(numValue) ? null : numValue);
                  }}
                  class="text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white"
                />
              {:else}
                <input 
                  type="text" 
                  value={editedData[item.fieldKey] || ''}
                  oninput={(e) => updateField(item.fieldKey, (e.target as HTMLInputElement).value)}
                  class="text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white"
                />
              {/if}
            {:else}
              <span class="text-sm text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 rounded px-2 py-1">
                {item.value}
              </span>
            {/if}
          </div>
        {/each}
      </div>
    {:else if isLoading}
      <div class="flex justify-center py-2">
        <span class="text-sm text-gray-500 dark:text-gray-400">Loading details...</span>
      </div>
    {/if}
  </div>
</div>

<!-- User feedback input -->
<div class="mb-4 flex items-start gap-3">
  <div class="flex-1">
    <textarea
      bind:value={userFeedback}
      placeholder="Any additional instructions or changes? (optional)"
      rows="2"
      class="resize-none w-full px-6 py-4 text-md lg:text-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm focus:ring focus:ring-blue-500 focus:border-blue-500 transition-colors"
      
      ></textarea>
  </div>
</div>

<!-- Action buttons -->
<div class="flex justify-end gap-2">
  <button 
    onclick={onCancel}
    disabled={isConfirming}
    class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 transition-colors"
  >
    Cancel
  </button>
  <button 
    onclick={handleConfirm}
    disabled={isConfirming}
    class="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  >
    {isConfirming ? 'Confirming...' : 'Confirm'}
  </button>
</div>