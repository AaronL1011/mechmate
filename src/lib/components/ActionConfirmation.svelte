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
    onConfirm: () => void;
    onCancel: () => void;
    isConfirming?: boolean;
  }

  const { action, onConfirm, onCancel, isConfirming = false }: Props = $props();

  // State for lookup data
  let equipmentTypes = $state<Array<{id: number, name: string}>>([]);
  let taskTypes = $state<Array<{id: number, name: string}>>([]);
  let isLoading = $state(true);

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

  function getActionIcon(type: string): string {
    switch (type) {
      case 'create': return '➕';
      case 'update': return '✏️';
      case 'delete': return '🗑️';
      default: return '📋';
    }
  }

  function getEntityIcon(entity: string): string {
    switch (entity) {
      case 'equipment': return '🔧';
      case 'task': return '📋';
      case 'maintenance_log': return '📝';
      default: return '📄';
    }
  }

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
        return 'Serial Number';
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

  function formatData(data: any): Array<{ key: string; value: any }> {
    if (!data) return [];
    
    const formatted: Array<{ key: string; value: any }> = [];
    
    for (const [key, value] of Object.entries(data)) {
      if (key === 'id') continue;
      
      // Handle nested updates object
      if (key === 'updates' && typeof value === 'object') {
        for (const [updateKey, updateValue] of Object.entries(value)) {
          formatted.push({
            key: formatFieldName(updateKey),
            value: resolveValue(updateKey, updateValue)
          });
        }
      } else {
        formatted.push({
          key: formatFieldName(key),
          value: resolveValue(key, value)
        });
      }
    }
    
    return formatted;
  }
</script>

<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
  <div class="flex items-center gap-3 mb-3">
    <div class="text-2xl">
      {getActionIcon(action.type)}{getEntityIcon(action.entity)}
    </div>
    <div>
      <h3 class="font-semibold text-gray-900 dark:text-white capitalize">
        {action.type} {action.entity.replace('_', ' ')}
      </h3>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        {action.confirmation_message || `${action.type} ${action.entity.replace('_', ' ')}?`}
      </p>
    </div>
  </div>

  {#if action.data}
    <div class="space-y-2 mb-4">
      {#if isLoading}
        <div class="flex justify-center py-2">
          <span class="text-sm text-gray-500 dark:text-gray-400">Loading details...</span>
        </div>
      {:else}
        {#each formatData(action.data) as item}
          <div class="flex justify-between items-center py-1">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
              {item.key}:
            </span>
            <span class="text-sm text-gray-900 dark:text-white">
              {item.value}
            </span>
          </div>
        {/each}
      {/if}
    </div>
  {/if}

  <div class="flex justify-end gap-2">
    <button 
      onclick={onCancel}
      disabled={isConfirming}
      class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 transition-colors"
    >
      Cancel
    </button>
    <button 
      onclick={onConfirm}
      disabled={isConfirming}
      class="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isConfirming ? 'Confirming...' : 'Confirm'}
    </button>
  </div>
</div>