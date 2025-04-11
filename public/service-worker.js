// Service Worker for Hafaloha Web App
// Handles push notifications and offline functionality

const CACHE_NAME = 'hafaloha-cache-v1';
const OFFLINE_URL = '/offline.html';
const VERSION = '1.0.1'; // Increment this when you update the service worker

console.log(`[Service Worker] Initializing service worker version ${VERSION}`);

// Files to cache for offline use
const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/badge-96.png'
];

// Install event - cache assets for offline use
self.addEventListener('install', event => {
  console.log(`[Service Worker] Installing Service Worker version ${VERSION}...`);
  
  // Skip waiting to ensure the new service worker activates immediately
  self.skipWaiting();
  console.log('[Service Worker] Skip waiting called');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] App shell cached successfully');
      })
      .catch(error => {
        console.error('[Service Worker] Cache install error:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log(`[Service Worker] Activating Service Worker version ${VERSION}...`);
  
  // Claim clients to ensure the service worker controls all clients immediately
  const claimPromise = self.clients.claim()
    .then(() => {
      console.log('[Service Worker] Clients claimed successfully');
    })
    .catch(error => {
      console.error('[Service Worker] Error claiming clients:', error);
    });
  
  // Clean up old caches
  const cleanCachesPromise = caches.keys()
    .then(cacheNames => {
      console.log('[Service Worker] Found caches:', cacheNames);
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('[Service Worker] Cache cleanup completed');
    })
    .catch(error => {
      console.error('[Service Worker] Error cleaning caches:', error);
    });
  
  // Wait for both operations to complete
  event.waitUntil(Promise.all([claimPromise, cleanCachesPromise]));
  
  // Log that we're ready to handle push events
  console.log('[Service Worker] Ready to handle push events');
});

// Fetch event - serve from cache if available, otherwise fetch from network
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // For API requests, use network-first strategy
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  // For page navigations, use cache-first strategy
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }
  
  // For other requests, use cache-first strategy with better error handling
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        
        return fetch(event.request)
          .then(response => {
            // Don't cache responses that aren't successful
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response since it can only be consumed once
            const responseToCache = response.clone();
            
            // Try to cache but don't fail if caching fails (for incognito mode)
            try {
              caches.open(CACHE_NAME)
                .then(cache => {
                  try {
                    cache.put(event.request, responseToCache);
                  } catch (cacheError) {
                    console.warn('[Service Worker] Cache put error (likely incognito mode):', cacheError);
                  }
                })
                .catch(cacheOpenError => {
                  console.warn('[Service Worker] Cache open error (likely incognito mode):', cacheOpenError);
                });
            } catch (error) {
              console.warn('[Service Worker] Caching error (likely incognito mode):', error);
            }
            
            return response;
          })
          .catch(error => {
            console.error('[Service Worker] Fetch error:', error);
            // Return a proper error response instead of undefined
            return new Response(JSON.stringify({ error: 'Network request failed' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          });
      })
      .catch(error => {
        console.error('[Service Worker] Cache match error:', error);
        // Return a proper error response
        return new Response(JSON.stringify({ error: 'Service worker error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', event => {
  console.log('[Service Worker] Push received:', event);
  
  let data = {};
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (error) {
    console.error('[Service Worker] Error parsing push data:', error);
    data = {
      title: 'New Notification',
      body: 'Something new happened in Hafaloha.',
      icon: '/icons/icon-192.png'
    };
  }
  
  const title = data.title || 'Hafaloha';
  const options = {
    body: data.body || 'New notification from Hafaloha',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/badge-96.png',
    tag: data.tag || 'hafaloha-notification',
    data: data.data || {},
    actions: data.actions || [],
    vibrate: [100, 50, 100],
    renotify: true,
    requireInteraction: true
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event - handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click:', event);
  
  event.notification.close();
  
  // Handle notification action clicks
  if (event.action) {
    console.log('[Service Worker] Action clicked:', event.action);
    
    // Handle specific actions
    if (event.action === 'view' && event.notification.data && event.notification.data.url) {
      event.waitUntil(
        clients.openWindow(event.notification.data.url)
      );
      return;
    }
    
    if (event.action === 'acknowledge' && event.notification.data && event.notification.data.orderId) {
      // TODO: Implement order acknowledgment via API call
      console.log('[Service Worker] Acknowledging order:', event.notification.data.orderId);
      return;
    }
  }
  
  // Default behavior - open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(clientList => {
        // If a window is already open, focus it
        for (const client of clientList) {
          if (client.url.includes('/admin') && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow('/admin/orders');
        }
      })
  );
});

// Notification close event - handle notification dismissals
self.addEventListener('notificationclose', event => {
  console.log('[Service Worker] Notification closed:', event);
});

console.log('[Service Worker] Service Worker registered successfully');
