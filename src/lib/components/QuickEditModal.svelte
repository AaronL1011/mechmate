<script lang="ts">
  import type { Equipment, TaskType, EquipmentType } from '$lib/types/db.js';
  import ActionConfirmation from './ActionConfirmation.svelte';

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
  })

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
      }
      
    } catch (error) {
      console.error('Failed to process input:', error);
      errorMessage = 'Failed to connect to the service. Please try again.';
    } finally {
      isProcessing = false;
    }
  }

  async function confirmAction() {
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
          confirmed: true
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
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-gray-100/60 dark:bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-200">
    <div class="w-full max-w-lg mx-4 p-6 animate-in zoom-in-95 duration-1000">
      <div class="mb-6" class:hidden={showSuccessState}>
        <div class="flex gap-3 items-center h-fit mb-2">
          <img src="/robot.png" alt="mech assistant" class="h-10 w-10">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Mech Assistant</h2>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Ask me to create equipment, schedule and update tasks, or log some completed maintenance
        </p>
      </div>
      
      <!-- Show success state -->
      {#if showSuccessState}
        <div class="text-center py-8 animate-in zoom-in-95 duration-300">
          <div class="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Success!</h3>
          <p class="text-gray-600 dark:text-gray-400 text-sm mb-6">{responseMessage}</p>
          <button 
            onclick={handleClose}
            class="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      {:else if pendingAction}
        <ActionConfirmation 
          action={pendingAction}
          onConfirm={confirmAction}
          onCancel={cancelAction}
          isConfirming={isConfirming}
        />
      {:else}
        <!-- Input area -->
        <textarea
          bind:this={textareaElement}
          bind:value={input}
          rows={4}
          placeholder="e.g. 'Add my 2015 Honda Civic with 85,000 km' or 'Schedule an oil change on the bike every 3000 km'"
          class="resize-none w-full px-6 py-4 text-md lg:text-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm focus:ring focus:ring-blue-500 focus:border-blue-500 transition-colors"
          onkeydown={handleKeyDown}
          disabled={isProcessing}
        ></textarea>
        
        <!-- Error messages -->
        {#if errorMessage}
          <div class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p class="text-red-800 dark:text-red-200 text-sm">{errorMessage}</p>
          </div>
        {/if}
        
        <!-- Response messages for non-action responses -->
        {#if responseMessage && !showSuccessState}
          <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p class="text-blue-800 dark:text-blue-200 text-sm">{responseMessage}</p>
          </div>
        {/if}
        
        <div class="flex justify-between mt-6">
          <button 
            onclick={onClose} 
            disabled={isProcessing}
            class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            disabled={!input.trim() || isProcessing}
            onclick={processInput}
            class="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? 'Processing...' : 'Submit'}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}