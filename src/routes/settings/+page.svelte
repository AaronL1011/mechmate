<script lang="ts">
  import { onMount } from 'svelte';
  import type { GlobalSettingsValues, NotificationSettingsDisplay } from '$lib/types/db.js';

  let appLoading = false;
  let notificationLoading = false;
  let appError = '';
  let appSuccess = false;
  let notificationError = '';
  let notificationSuccess = '';
  let settings: GlobalSettingsValues = {
    upcoming_task_range_days: 90
  };

  // Notification settings
  let notificationSettings: NotificationSettingsDisplay | null = null;
  let notificationFormData = {
    enabled: false,
    threshold_1_month: false,
    threshold_2_weeks: false,
    threshold_1_week: true,
    threshold_3_days: false,
    threshold_1_day: true,
    threshold_due_date: true,
    threshold_overdue_daily: false
  };

  // Notification state
  let notificationPermission: NotificationPermission = 'default';
  let serviceWorkerReady = false;
  let subscriptions: any[] = [];
  let pushSubscription: PushSubscription | null = null;
  let vapidPublicKey = '';

  // Form state
  let formValues = {
    upcoming_task_range_days: 90
  };

  // Check if current device has a subscription by comparing endpoints
  $: currentDeviceHasSubscription = pushSubscription !== null && 
    subscriptions.some(sub => sub.endpoint === pushSubscription?.endpoint);

  onMount(async () => {
    await loadSettings();
    await checkServiceWorker();
    checkNotificationPermission();
    await loadNotificationSettings();
  });

  async function loadSettings() {
    try {
      appLoading = true;
      appError = '';
      
      const response = await fetch('/api/settings');
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }
      
      settings = await response.json();
      formValues = { ...settings };
    } catch (err) {
      appError = 'Failed to load settings';
      console.error(err);
    } finally {
      appLoading = false;
    }
  }

  async function loadNotificationSettings() {
    try {
      const response = await fetch('/api/notifications/settings');
      if (response.ok) {
        const data = await response.json();
        notificationSettings = data.settings;
        subscriptions = data.subscriptions || [];
        vapidPublicKey = data.vapidPublicKey;
        
        // Initialize form data with current settings
        if (notificationSettings) {
          notificationFormData = {
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
      }
    } catch (err) {
      console.error('Failed to load notification settings:', err);
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

  // Notification functions
  async function requestNotificationPermission() {
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        notificationPermission = permission;
        
        if (permission === 'granted') {
          await subscribeToPush();
        }
      } catch (err) {
        notificationError = 'Failed to request notification permission';
        console.error('Permission request failed:', err);
      }
    }
  }

  async function subscribeToPush() {
    if (!serviceWorkerReady || !vapidPublicKey) {
      notificationError = 'Service Worker or VAPID key not available';
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

        notificationSuccess = 'Push notifications enabled successfully!';
        setTimeout(() => notificationSuccess = '', 3000);
        await loadNotificationSettings(); // Refresh subscription list
      }
    } catch (err) {
      notificationError = 'Failed to enable push notifications';
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
        notificationSuccess = 'Push notifications disabled successfully!';
        setTimeout(() => notificationSuccess = '', 3000);
        await loadNotificationSettings(); // Refresh subscription list
      }
    } catch (err) {
      notificationError = 'Failed to disable push notifications';
      console.error('Push unsubscription failed:', err);
    }
  }

  async function saveNotificationSettings() {
    try {
      notificationLoading = true;
      notificationError = '';

      const response = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationFormData)
      });

      if (!response.ok) {
        throw new Error('Failed to save notification settings');
      }

      const data = await response.json();
      notificationSettings = data.settings;
      notificationSuccess = 'Notification settings updated successfully!';
      setTimeout(() => notificationSuccess = '', 3000);

    } catch (err) {
      notificationError = 'Failed to save notification settings';
      console.error('Save error:', err);
    } finally {
      notificationLoading = false;
    }
  }

  async function handleGlobalNotificationToggle(e: Event) {
    const target = e.target as HTMLInputElement;
    notificationFormData.enabled = target.checked;
    
    if (!target.checked) {
      // Disabling notifications globally - unsubscribe from this device
      await unsubscribeFromPush();
    }

    // Save the global setting immediately
    await saveNotificationSettings();
  }

  async function handleThresholdChange() {
    // Save threshold changes immediately
    await saveNotificationSettings();
  }

  async function addCurrentDevice() {
    try {
      notificationLoading = true;
      notificationError = '';

      // Request permission if not granted
      if (Notification.permission !== 'granted') {
        await requestNotificationPermission();
        if (notificationPermission !== 'granted') {
          notificationError = 'Notification permission is required to add this device';
          notificationLoading = false;
          return;
        }
      }

      // Subscribe to push notifications
      if (!pushSubscription) {
        await subscribeToPush();
      }

    } catch (err) {
      notificationError = 'Failed to add this device';
      console.error('Add device error:', err);
    } finally {
      notificationLoading = false;
    }
  }

  async function sendTestNotification() {
    try {
      notificationLoading = true;
      notificationError = '';

      const response = await fetch('/api/notifications/test', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to send test notification');
      }

      const data = await response.json();
      notificationSuccess = data.message;
      setTimeout(() => notificationSuccess = '', 3000);
      } catch (err) {
      notificationError = 'Failed to send test notification';
      console.error('Test notification error:', err);
    } finally {
      notificationLoading = false;
    }
  }

  async function deleteSubscription(subscriptionId: number) {
    if (!confirm('Remove this device from receiving notifications?')) {
      return;
    }

    try {
      notificationLoading = true;
      notificationError = '';

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

        notificationSuccess = 'Device removed successfully';
        setTimeout(() => notificationSuccess = '', 3000);
        await loadNotificationSettings(); // Refresh the subscription list
      }
    } catch (err) {
      notificationError = 'Failed to remove device';
      console.error('Delete subscription error:', err);
    } finally {
      notificationLoading = false;
    }
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

  async function saveSettings() {
    try {
      appLoading = true;
      appError = '';
      appSuccess = false;

      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formValues)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save settings');
      }

      const result = await response.json();
      
      if (result.errors && Object.keys(result.errors).length > 0) {
        appError = 'Some settings could not be updated: ' + Object.values(result.errors).join(', ');
      } else {
        appSuccess = true;
        settings = { ...formValues };
        setTimeout(() => appSuccess = false, 3000);
      }
    } catch (err) {
      appError = err instanceof Error ? err.message : 'Failed to save settings';
      console.error(err);
    } finally {
      appLoading = false;
    }
  }

  function resetForm() {
    formValues = { ...settings };
    appError = '';
    appSuccess = false;
  }

  function resetToDefaults() {
    formValues = {
      upcoming_task_range_days: 90
    };
  }

  $: hasChanges = JSON.stringify(formValues) !== JSON.stringify(settings);
</script>

<svelte:head>
  <title>Settings - Mechmate</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8 py-8">
  <!-- Header -->
  <header class="max-w-4xl mx-auto mb-8">
    <div class="flex items-center gap-4 mb-4">
      <a href="/" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" aria-label="return to dashboard">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
          <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path>
        </svg>
      </a>
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p class="text-gray-600 dark:text-gray-300">Configure your Mechmate preferences</p>
      </div>
    </div>
  </header>

  <main class="max-w-4xl mx-auto">
    {#if appLoading && !settings}
      <div class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    {:else}
      <div class="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Application Settings</h2>
        </div>

        <form on:submit|preventDefault={saveSettings} class="p-6 space-y-6">
          <!-- Task Range Setting -->
          <div class="space-y-2">
            <label for="upcoming_task_range_days" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Upcoming Task Range
            </label>
            <div class="space-y-1">
              <input
                type="number"
                id="upcoming_task_range_days"
                name="upcoming_task_range_days"
                bind:value={formValues.upcoming_task_range_days}
                min="1"
                max="365"
                required
                class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Number of days to look ahead for upcoming tasks (1-365 days). Currently set to {settings.upcoming_task_range_days} days.
              </p>
            </div>
          </div>

          
          
          <!-- Messages -->
          {#if appError}
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p class="text-red-800 dark:text-red-200">{appError}</p>
          </div>
          {/if}
          
          {#if appSuccess}
          <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p class="text-green-800 dark:text-green-200">Application settings saved successfully!</p>
          </div>
          {/if}
          
          <!-- Form Actions -->
          <div class="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
            <div class="flex space-x-3">
              <button
              type="button"
              on:click={resetToDefaults}
              class="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
              Reset to Defaults
            </button>
            {#if hasChanges}
            <button
            type="button"
            on:click={resetForm}
            class="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
            Cancel Changes
          </button>
          {/if}
        </div>
        
        <button
        type="submit"
        disabled={appLoading || !hasChanges}
        class="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
        {#if appLoading}
        <div class="flex items-center">
          <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          Saving...
        </div>
        {:else}
        Save Settings
        {/if}
      </button>
    </div>
  </form>
</div>

<!-- Notification Settings Section -->
<div class="bg-white dark:bg-gray-800 shadow rounded-lg mt-8">
  <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
    <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Notification Settings</h2>
  </div>

   <!-- Messages -->
   {#if notificationError}
   <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mx-4 mt-4">
     <p class="text-red-800 dark:text-red-200">{notificationError}</p>
   </div>
   {/if}
   
   {#if notificationSuccess}
   <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mx-4 mt-4">
     <p class="text-green-800 dark:text-green-200">{notificationSuccess}</p>
   </div>
   {/if}

  <!-- Global Enable/Disable -->
  <div class="space-y-4 p-6">
    <div class="flex items-center justify-between gap-2">
      <div>
        <h4 class="text-sm font-medium text-gray-900 dark:text-white">Enable Notifications</h4>
        <p class="text-sm text-gray-600 dark:text-gray-400">Receive push notifications for upcoming and overdue maintenance tasks</p>
      </div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          bind:checked={notificationFormData.enabled}
          on:change={handleGlobalNotificationToggle}
          class="sr-only peer"
        />
        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
      </label>
    </div>

    <!-- Add Current Device Button -->
    {#if !currentDeviceHasSubscription}
    <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h5 class="text-sm font-medium text-blue-900 dark:text-blue-200">Add This Device</h5>
          <p class="text-sm text-blue-700 dark:text-blue-300">This device is not receiving notifications yet</p>
        </div>
        <button
          class="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 rounded-md transition-colors disabled:opacity-50 whitespace-nowrap"
          on:click={addCurrentDevice}
          disabled={notificationLoading}
        >
          {#if notificationLoading}
            <div class="flex items-center">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Adding...
            </div>
          {:else}
            Add Device
          {/if}
        </button>
      </div>
    </div>
  {/if}

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
  {#if notificationFormData.enabled}
    <div class="space-y-4 p-6">
      <h4 class="text-sm font-medium text-gray-900 dark:text-white">Notification Thresholds</h4>
      <p class="text-sm text-gray-600 dark:text-gray-400">Choose when to receive notifications before and after tasks are due</p>
      
      <div class="space-y-3">
        <label class="flex items-center space-x-3">
          <input
            type="checkbox"
            bind:checked={notificationFormData.threshold_1_month}
            on:change={handleThresholdChange}
            class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">1 month before due</span>
        </label>

        <label class="flex items-center space-x-3">
          <input
            type="checkbox"
            bind:checked={notificationFormData.threshold_2_weeks}
            on:change={handleThresholdChange}
            class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">2 weeks before due</span>
        </label>

        <label class="flex items-center space-x-3">
          <input
            type="checkbox"
            bind:checked={notificationFormData.threshold_1_week}
            on:change={handleThresholdChange}
            class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">1 week before due</span>
        </label>

        <label class="flex items-center space-x-3">
          <input
            type="checkbox"
            bind:checked={notificationFormData.threshold_3_days}
            on:change={handleThresholdChange}
            class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">3 days before due</span>
        </label>

        <label class="flex items-center space-x-3">
          <input
            type="checkbox"
            bind:checked={notificationFormData.threshold_1_day}
            on:change={handleThresholdChange}
            class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">1 day before due</span>
        </label>

        <label class="flex items-center space-x-3">
          <input
            type="checkbox"
            bind:checked={notificationFormData.threshold_due_date}
            on:change={handleThresholdChange}
            class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">On due date</span>
        </label>

        <label class="flex items-center space-x-3">
          <input
            type="checkbox"
            bind:checked={notificationFormData.threshold_overdue_daily}
            on:change={handleThresholdChange}
            class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">Daily reminders when overdue</span>
        </label>
      </div>
    </div>

    <!-- Active Devices -->
    <div class="space-y-4 p-6 ">
      <h4 class="text-sm font-medium text-gray-900 dark:text-white">Active Devices</h4>
      <p class="text-sm text-gray-600 dark:text-gray-400">Notifications will be sent to these devices</p>
        
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
                  on:click={() => deleteSubscription(subscription.id)}
                  disabled={notificationLoading}
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

      <!-- Test Notification -->
      {#if notificationFormData.enabled && notificationPermission === 'granted'}
        <div class="border-t border-gray-200 dark:border-gray-600 pt-4">
          <button
            class="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
            on:click={sendTestNotification}
            disabled={notificationLoading}
          >
            {#if notificationLoading}
              <div class="flex items-center justify-center">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 dark:border-gray-300 mr-2"></div>
                Sending...
              </div>
            {:else}
              Send Test Notification
            {/if}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>


<!-- Settings Information -->
<div class="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 class="text-lg font-medium text-blue-900 dark:text-blue-100 mb-2">About Settings</h3>
        <div class="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <p><strong>Upcoming Task Range:</strong> Controls how far into the future the application looks when displaying upcoming tasks on the dashboard and in task lists. This affects both the "Upcoming" counter on the dashboard and the tasks shown in your upcoming tasks view.</p>
          <p><strong>Notifications:</strong> Push notifications help you stay on top of maintenance tasks. Enable notifications and add your devices to receive reminders before tasks are due. You can customize when notifications are sent using the threshold settings.</p>
        </div>
      </div>
    {/if}
  </main>
</div>