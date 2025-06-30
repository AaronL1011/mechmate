<script lang="ts">
  import { onMount } from 'svelte';
  import type { NotificationSettingsDisplay } from '$lib/types/db.js';
  import NotificationModal from './NotificationModal.svelte';

  let showModal = false;
  let notificationSettings: NotificationSettingsDisplay | null = null;
  let isEnabled = false;
  let hasPermission = false;

  onMount(async () => {
    await loadSettings();
    checkNotificationPermission();
  });

  async function loadSettings() {
    try {
      const response = await fetch('/api/notifications/settings');
      if (response.ok) {
        const data = await response.json();
        notificationSettings = data.settings;
        isEnabled = data.settings?.enabled || false;
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  }

  function checkNotificationPermission() {
    if ('Notification' in window) {
      hasPermission = Notification.permission === 'granted';
    }
  }

  function openModal() {
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    // Reload settings after modal closes
    loadSettings();
    checkNotificationPermission();
  }

  // Determine bell state for visual indication
  $: bellState = isEnabled && hasPermission ? 'enabled' : 'disabled';
</script>

<!-- Notification Bell Button -->
<button
  class="relative rounded-lg p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-400"
  on:click={openModal}
  aria-label="Notification settings"
  title={isEnabled && hasPermission ? 'Notifications enabled' : 'Notifications disabled'}
>
  <!-- Bell Icon -->
  {#if isEnabled}
  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="currentColor" viewBox="0 0 256 256"><path d="M224,71.1a8,8,0,0,1-10.78-3.42,94.13,94.13,0,0,0-33.46-36.91,8,8,0,1,1,8.54-13.54,111.46,111.46,0,0,1,39.12,43.09A8,8,0,0,1,224,71.1ZM35.71,72a8,8,0,0,0,7.1-4.32A94.13,94.13,0,0,1,76.27,30.77a8,8,0,1,0-8.54-13.54A111.46,111.46,0,0,0,28.61,60.32,8,8,0,0,0,35.71,72Zm186.1,103.94A16,16,0,0,1,208,200H167.2a40,40,0,0,1-78.4,0H48a16,16,0,0,1-13.79-24.06C43.22,160.39,48,138.28,48,112a80,80,0,0,1,160,0C208,138.27,212.78,160.38,221.81,175.94ZM150.62,200H105.38a24,24,0,0,0,45.24,0Z"></path></svg>
  {:else}
    <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="currentColor" viewBox="0 0 256 256"><path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z"></path></svg>
  {/if}
  <!-- Status indicator dot -->
  {#if isEnabled && !hasPermission}
    <span 
      class="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 border-2 border-white dark:border-gray-800 rounded-full"
      aria-hidden="true"
    ></span>
  {:else if isEnabled && hasPermission}
  <span 
    class="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"
    aria-hidden="true"
  ></span>
  {/if}
</button>

<!-- Notification Settings Modal -->
{#if showModal}
  <NotificationModal 
    on:close={closeModal}
    {notificationSettings}
  />
{/if}