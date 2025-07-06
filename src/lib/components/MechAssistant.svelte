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
    gfm: true,
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
      <div class="mb-8" class:hidden={showSuccessState}>
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
      <!-- Error messages -->
      {#if errorMessage}
        <div class="mb-4 flex items-start gap-3 max-h-[50vh] overflow-y-auto scrollbar-hidden">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <img src="/robot.png" alt="assistant" class="w-5 h-5 opacity-75">
          </div>
          <div class="max-w-xs bg-red-50 dark:bg-red-900/20 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
            <p class="text-red-800 dark:text-red-200 text-sm leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      {/if}
      
      <!-- Response messages for non-action responses -->
      {#if responseMessage && !showSuccessState}
        <div class="mb-4 flex items-start gap-3 max-h-[50vh] overflow-y-auto scrollbar-hidden">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <img src="/robot.png" alt="assistant" class="w-5 h-5">
          </div>
          <div class="max-w-sm bg-gray-50 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700">
            <div class="text-gray-800 dark:text-gray-200 text-sm leading-relaxed prose prose-sm prose-gray dark:prose-invert max-w-none
                       prose-p:my-2 prose-p:leading-relaxed
                       prose-strong:text-gray-900 dark:prose-strong:text-gray-100
                       prose-code:text-blue-600 dark:prose-code:text-blue-400 prose-code:bg-gray-100 dark:prose-code:bg-gray-700 prose-code:px-1 prose-code:rounded
                       prose-ul:my-2 prose-ol:my-2 prose-li:my-1
                       prose-headings:text-gray-900 dark:prose-headings:text-gray-100">
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
          class="resize-none w-full px-6 py-4 text-md lg:text-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm focus:ring focus:ring-blue-500 focus:border-blue-500 transition-colors"
          onkeydown={handleKeyDown}
          disabled={isProcessing}
        ></textarea>
        
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