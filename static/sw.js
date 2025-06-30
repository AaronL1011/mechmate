// Service Worker for Push Notifications
// This handles background push notifications and click events

const CACHE_NAME = 'mechmate-notifications-v1';

// Install event
self.addEventListener('install', () => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

// Push event - handle incoming notifications
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);

  if (!event.data) {
    console.log('Push event has no data');
    return;
  }

  try {
    const payload = event.data.json();
    console.log('Push payload:', payload);

    const notificationOptions = {
      body: payload.body,
      icon: payload.icon || '/robot.png',
      badge: payload.badge || '/robot.png',
      data: payload.data || { url: '/' },
      tag: 'mechmate-notification',
      renotify: true,
      requireInteraction: false,
      silent: false,
      vibrate: [200, 100, 200]
    };

    event.waitUntil(
      self.registration.showNotification(payload.title, notificationOptions)
    );
  } catch (error) {
    console.error('Error processing push event:', error);
    
    // Fallback notification if JSON parsing fails
    event.waitUntil(
      self.registration.showNotification('Mechmate Maintenance Reminder', {
        body: 'You have maintenance tasks that need attention',
        icon: '/robot.png',
        data: { url: '/' }
      })
    );
  }
});

// Notification click event - handle user clicking on notification
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Check if there's already an open client
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Focus existing client and navigate to the URL
            client.focus();
            if ('navigate' in client) {
              client.navigate(urlToOpen);
            }
            return;
          }
        }

        // If no client is open, open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
      .catch((error) => {
        console.error('Error handling notification click:', error);
      })
  );
});

// Handle notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
  // Could track analytics here if needed
});

// Handle sync events (for future offline support)
self.addEventListener('sync', (event) => {
  console.log('Background sync event:', event);
  
  if (event.tag === 'notification-sync') {
    event.waitUntil(
      // Could implement offline notification queueing here
      Promise.resolve()
    );
  }
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});