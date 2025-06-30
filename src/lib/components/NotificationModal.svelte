<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { NotificationSettingsDisplay } from '$lib/types/db.js';
  
  export let notificationSettings: NotificationSettingsDisplay | null = null;

  const dispatch = createEventDispatcher();

  // Component state
  let loading = false;
  let error = '';
  let success = '';
  let vapidPublicKey = '';
  let subscriptions: any[] = [];
  let pushSubscription: PushSubscription | null = null;

  // Form state - initialize with current settings or defaults
  let formData = {
    enabled: false,
    threshold_1_month: false,
    threshold_2_weeks: false,
    threshold_1_week: true,
    threshold_3_days: false,
    threshold_1_day: true,
    threshold_due_date: true,
    threshold_overdue_daily: false
  };

  // Permission state
  let notificationPermission: NotificationPermission = 'default';
  let serviceWorkerReady = false;

  // Check if current device has a subscription by comparing endpoints
  $: currentDeviceHasSubscription = pushSubscription !== null && 
    subscriptions.some(sub => sub.endpoint === pushSubscription?.endpoint);

  onMount(async () => {
    await checkServiceWorker();
    checkNotificationPermission();
    await loadData();
    
    // Initialize form data with current settings
    if (notificationSettings) {
      formData = {
        enabled: notificationSettings.enabled,
        threshold_1_month: notificationSettings.threshold_1_month,
        threshold_2_weeks: notificationSettings.threshold_2_weeks,
        threshold_1_week: notificationSettings.threshold_1_week,
        threshold_3_days: notificationSettings.threshold_3_days,
        threshold_1_day: notificationSettings.threshold_1_day,
        threshold_due_date: notificationSettings.threshold_due_date,
        threshold_overdue_daily: notificationSettings.threshold_overdue_daily
      };
    }
  });

  async function loadData() {
    try {
      const response = await fetch('/api/notifications/settings');
      if (response.ok) {
        const data = await response.json();
        notificationSettings = data.settings;
        subscriptions = data.subscriptions || [];
        vapidPublicKey = data.vapidPublicKey;
        
        // Validate current subscription if it exists
        // await validateCurrentSubscription();
      }
    } catch (err) {
      error = 'Failed to load notification settings';
      console.error('Error loading data:', err);
    }
  }

  async function checkServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        serviceWorkerReady = !!registration;
        
        // Also check if we already have a push subscription
        if (registration) {
          pushSubscription = await registration.pushManager.getSubscription();
        }
      } catch (err) {
        console.error('Service Worker not ready:', err);
        serviceWorkerReady = false;
      }
    }
  }

  function checkNotificationPermission() {
    if ('Notification' in window) {
      notificationPermission = Notification.permission;
    }
  }

  async function validateCurrentSubscription() {
    // If we have a browser subscription but it's not in the server list,
    // it means the subscription was deleted from another device
    if (pushSubscription && !currentDeviceHasSubscription) {
      console.log('Current subscription not found on server, unsubscribing locally...');
      
      try {
        // Unsubscribe from the browser to clear the stale subscription
        await pushSubscription.unsubscribe();
        pushSubscription = null;
        console.log('Stale subscription cleared from browser');
      } catch (err) {
        console.error('Failed to clear stale subscription:', err);
        // Even if unsubscribe fails, clear our local reference
        pushSubscription = null;
      }
    }
  }

  async function requestNotificationPermission() {
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        notificationPermission = permission;
        
        if (permission === 'granted') {
          await subscribeToPush();
        }
      } catch (err) {
        error = 'Failed to request notification permission';
        console.error('Permission request failed:', err);
      }
    } else {
      console.error('No Notification object in window')
    }
  }

  async function subscribeToPush() {
    if (!serviceWorkerReady || !vapidPublicKey) {
      error = 'Service Worker or VAPID key not available';
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Check if already subscribed
      pushSubscription = await registration.pushManager.getSubscription();
      
      if (!pushSubscription) {
        // Create new subscription
        pushSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });

        // Send subscription to server
        const subscriptionData = {
          endpoint: pushSubscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(pushSubscription.getKey('p256dh')),
            auth: arrayBufferToBase64(pushSubscription.getKey('auth'))
          },
          userAgent: navigator.userAgent
        };

        const response = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscriptionData)
        });

        if (!response.ok) {
          throw new Error('Failed to register push subscription');
        }

        success = 'Push notifications enabled successfully!';
        await loadData(); // Refresh subscription list
      }
    } catch (err) {
      error = 'Failed to enable push notifications';
      console.error('Push subscription failed:', err);
    }
  }

  async function unsubscribeFromPush() {
    try {
      if (pushSubscription) {
        await pushSubscription.unsubscribe();
        
        // Remove from server
        const response = await fetch('/api/notifications/unsubscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: pushSubscription.endpoint })
        });

        if (!response.ok) {
          throw new Error('Failed to unregister push subscription');
        }

        pushSubscription = null;
        success = 'Push notifications disabled successfully!';
        await loadData(); // Refresh subscription list
      }
    } catch (err) {
      error = 'Failed to disable push notifications';
      console.error('Push unsubscription failed:', err);
    }
  }

  async function saveGlobalSettings() {
    loading = true;
    error = '';
    success = '';

    try {
      // Save settings to server
      const response = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      const data = await response.json();
      notificationSettings = data.settings;
      success = 'Settings updated successfully!';

      // Clear success message after 3 seconds
      setTimeout(() => {
        success = '';
      }, 3000);

    } catch (err) {
      error = 'Failed to save notification settings';
      console.error('Save error:', err);
    } finally {
      loading = false;
    }
  }

  async function handleGlobalNotificationToggle(e: Event) {
    const target = e.target as HTMLInputElement;
    formData.enabled = target.checked;
    
    if (!target.checked) {
      // Disabling notifications globally - unsubscribe from this device
      await unsubscribeFromPush();
    }

    // Save the global setting immediately
    await saveGlobalSettings();
  }

  async function handleThresholdChange() {
    // Save threshold changes immediately
    await saveGlobalSettings();
  }

  async function addCurrentDevice() {
    loading = true;
    error = '';
    success = '';

    try {
      // Request permission if not granted
      if (Notification.permission !== 'granted') {
        await requestNotificationPermission();
        if (notificationPermission !== 'granted') {
          error = 'Notification permission is required to add this device';
          loading = false;
          return;
        }
      }

      // Subscribe to push notifications
      if (!pushSubscription) {
        await subscribeToPush();
        success = 'This device has been added successfully!';
      } else {
        success = 'This device is already subscribed to notifications';
      }

    } catch (err) {
      error = 'Failed to add this device';
      console.error('Add device error:', err);
    } finally {
      loading = false;
    }
  }

  async function sendTestNotification() {
    loading = true;
    error = '';
    success = '';

    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to send test notification');
      }

      const data = await response.json();
      success = data.message;
    } catch (err) {
      error = 'Failed to send test notification';
      console.error('Test notification error:', err);
    } finally {
      loading = false;
    }
  }

  async function deleteSubscription(subscriptionId: number) {
    if (!confirm('Remove this device from receiving notifications?')) {
      return;
    }

    loading = true;
    error = '';
    success = '';

    try {
      // Check if this is the current device's subscription
      const subscriptionToDelete = subscriptions.find(sub => sub.id === subscriptionId);
      const isCurrentDevice = pushSubscription && subscriptionToDelete && 
        pushSubscription.endpoint === subscriptionToDelete.endpoint;

      if (isCurrentDevice) {
        // If deleting current device, use unsubscribeFromPush to properly clean up
        await unsubscribeFromPush();
      } else {
        // Otherwise, delete via API
        const response = await fetch(`/api/notifications/subscriptions/${subscriptionId}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          throw new Error('Failed to delete subscription');
        }

        success = 'Device removed successfully';
        await loadData(); // Refresh the subscription list
      }
    } catch (err) {
      error = 'Failed to remove device';
      console.error('Delete subscription error:', err);
    } finally {
      loading = false;
    }
  }

  function closeModal() {
    dispatch('close');
  }

  // Utility functions
  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
    if (!buffer) return '';
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  function formatUserAgent(userAgent: string): string {
    if (userAgent.includes('Chrome')) return '🌐 Chrome';
    if (userAgent.includes('Firefox')) return '🦊 Firefox';
    if (userAgent.includes('Safari')) return '🧭 Safari';
    if (userAgent.includes('Edge')) return '🌊 Edge';
    return '💻 Browser';
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }
</script>

<!-- Modal Backdrop -->
<div 
  class="fixed inset-0 bg-gray-600/50 dark:bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
  onclick={closeModal}
  onkeydown={(e) => e.key === 'Escape' && closeModal()}
  role="dialog"
  aria-modal="true"
  aria-labelledby="notification-modal-title"
  tabindex="-1"
>
  <!-- Modal Content -->
  <div 
    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    tabindex="-1"
  >
    <!-- Modal Header -->
    <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
      <h2 id="notification-modal-title" class="text-xl font-semibold text-gray-900 dark:text-white">
        Notification Settings
      </h2>
      <button
        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        onclick={closeModal}
        aria-label="Close modal"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Modal Body -->
    <div class="p-6 space-y-6">
      <!-- Error/Success Messages -->
      {#if error}
        <div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-md">
          {error}
        </div>
      {/if}

      {#if success}
        <div class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-200 px-4 py-3 rounded-md">
          {success}
        </div>
      {/if}

      <!-- Global Enable/Disable -->
      <div class="space-y-4">
        <div class="flex items-center justify-between gap-2">
          <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Enable Notifications</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">Receive push notifications for upcoming and overdue maintenance tasks</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              bind:checked={formData.enabled}
              onchange={handleGlobalNotificationToggle}
              class="sr-only peer"
            />
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <!-- Permission Status -->
        <div class="bg-gray-50 dark:bg-gray-700 rounded-md p-4">
          <div class="flex items-center space-x-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Permission Status:</span>
            {#if notificationPermission === 'granted'}
              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                ✓ Granted
              </span>
            {:else if notificationPermission === 'denied'}
              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                ✗ Denied
              </span>
            {:else}
              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                ⚠ Not Requested
              </span>
            {/if}
          </div>
        </div>
      </div>

      <!-- Notification Thresholds -->
      {#if formData.enabled}
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">Notification Thresholds</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400">Choose when to receive notifications before and after tasks are due</p>
          
          <div class="space-y-3">
            <label class="flex items-center space-x-3">
              <input
                type="checkbox"
                bind:checked={formData.threshold_1_month}
                onchange={handleThresholdChange}
                class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">1 month before due</span>
            </label>

            <label class="flex items-center space-x-3">
              <input
                type="checkbox"
                bind:checked={formData.threshold_2_weeks}
                onchange={handleThresholdChange}
                class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">2 weeks before due</span>
            </label>

            <label class="flex items-center space-x-3">
              <input
                type="checkbox"
                bind:checked={formData.threshold_1_week}
                onchange={handleThresholdChange}
                class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">1 week before due</span>
            </label>

            <label class="flex items-center space-x-3">
              <input
                type="checkbox"
                bind:checked={formData.threshold_3_days}
                onchange={handleThresholdChange}
                class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">3 days before due</span>
            </label>

            <label class="flex items-center space-x-3">
              <input
                type="checkbox"
                bind:checked={formData.threshold_1_day}
                onchange={handleThresholdChange}
                class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">1 day before due</span>
            </label>

            <label class="flex items-center space-x-3">
              <input
                type="checkbox"
                bind:checked={formData.threshold_due_date}
                onchange={handleThresholdChange}
                class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">On due date</span>
            </label>

            <label class="flex items-center space-x-3">
              <input
                type="checkbox"
                bind:checked={formData.threshold_overdue_daily}
                onchange={handleThresholdChange}
                class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">Daily reminders when overdue</span>
            </label>
          </div>
        </div>
      {/if}

      <!-- Active Devices -->
      <div class="space-y-4">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">Active Devices</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {#if formData.enabled}
            Notifications will be sent to these devices
          {:else}
            Manage devices that have notification subscriptions
          {/if}
        </p>

        <!-- Add Current Device Button -->
        {#if formData.enabled && !currentDeviceHasSubscription}
          <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
            <div class="flex items-center justify-between gap-2">
              <div>
                <h4 class="text-sm font-medium text-blue-900 dark:text-blue-200">Add This Device</h4>
                <p class="text-sm text-blue-700 dark:text-blue-300">This device is not receiving notifications yet</p>
              </div>
              <button
                class="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 rounded-md transition-colors disabled:opacity-50 whitespace-nowrap"
                onclick={addCurrentDevice}
                disabled={loading}
              >
                {#if loading}
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Adding...
                {:else}
                  Add Device
                {/if}
              </button>
            </div>
          </div>
        {/if}
          
          {#if subscriptions.length > 0}
            <div class="space-y-2">
              {#each subscriptions as subscription}
                <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <div class="flex items-center space-x-3">
                    <span class="text-lg">{formatUserAgent(subscription.user_agent || '')}</span>
                    <div>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        {formatUserAgent(subscription.user_agent || 'Unknown Browser')}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        Added {formatDate(subscription.created_at)}
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center space-x-2">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                      Active
                    </span>
                    <button
                      class="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                      onclick={() => deleteSubscription(subscription.id)}
                      disabled={loading}
                      aria-label="Remove device"
                      title="Remove this device"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600">
              <svg class="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">No devices registered yet</p>
              <p class="text-xs text-gray-400 dark:text-gray-500">Enable notifications to register this device</p>
            </div>
          {/if}
      </div>

      <!-- Test Notification -->
      {#if formData.enabled && notificationPermission === 'granted'}
        <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
          <button
            class="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
            onclick={sendTestNotification}
            disabled={loading}
          >
            {#if loading}
              <svg class="animate-spin -ml-1 mr-3 h-4 w-4 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending...
            {:else}
              Send Test Notification
            {/if}
          </button>
        </div>
      {/if}
    </div>

  </div>
</div>