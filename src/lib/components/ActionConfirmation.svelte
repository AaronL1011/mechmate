<script lang="ts">
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

  function formatData(data: any): Array<{ key: string; value: any }> {
    if (!data) return [];
    
    const formatted: Array<{ key: string; value: any }> = [];
    
    for (const [key, value] of Object.entries(data)) {
      if (key === 'id' || key === 'updates') continue;
      
      // Handle nested updates object
      if (key === 'updates' && typeof value === 'object') {
        for (const [updateKey, updateValue] of Object.entries(value)) {
          formatted.push({
            key: updateKey.replace(/_/g, ' '),
            value: updateValue
          });
        }
      } else {
        formatted.push({
          key: key.replace(/_/g, ' '),
          value: value
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
      {#each formatData(action.data) as item}
        <div class="flex justify-between items-center py-1">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
            {item.key}:
          </span>
          <span class="text-sm text-gray-900 dark:text-white">
            {#if Array.isArray(item.value)}
              {item.value.join(', ')}
            {:else if typeof item.value === 'object'}
              {JSON.stringify(item.value)}
            {:else}
              {item.value}
            {/if}
          </span>
        </div>
      {/each}
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