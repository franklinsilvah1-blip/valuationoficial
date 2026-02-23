const CACHE_NAME = 'valuation-v2';
const STATIC_CACHE = 'static-v2';
const DYNAMIC_CACHE = 'dynamic-v2';

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/favicon.png',
  '/logo.webp',
  '/manifest.json'
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Cache first for static assets
  cacheFirst: async (request, cacheName) => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    
    try {
      const response = await fetch(request);
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      return cached;
    }
  },
  
  // Network first for dynamic content
  networkFirst: async (request, cacheName) => {
    const cache = await caches.open(cacheName);
    try {
      const response = await fetch(request);
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;
      throw error;
    }
  },
  
  // Stale while revalidate for API calls
  staleWhileRevalidate: async (request, cacheName) => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    const fetchPromise = fetch(request).then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    }).catch(() => cached);
    
    return cached || fetchPromise;
  }
};

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - apply caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) return;
  
  // Skip Supabase API calls (let them go through normally)
  if (url.hostname.includes('supabase.co')) return;
  
  // Skip analytics and tracking
  if (
    url.hostname.includes('google-analytics') ||
    url.hostname.includes('googletagmanager') ||
    url.hostname.includes('facebook')
  ) return;
  
  // Static assets - cache first
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'style' ||
    url.pathname.match(/\.(js|css|woff2?|ttf|otf|eot|svg|png|jpg|jpeg|webp|ico)$/)
  ) {
    event.respondWith(CACHE_STRATEGIES.cacheFirst(request, STATIC_CACHE));
    return;
  }
  
  // HTML pages - network first
  if (request.destination === 'document' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(CACHE_STRATEGIES.networkFirst(request, DYNAMIC_CACHE));
    return;
  }
  
  // Default - stale while revalidate
  event.respondWith(CACHE_STRATEGIES.staleWhileRevalidate(request, DYNAMIC_CACHE));
});

// Handle messages from the app
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});

// Push notification event handler
self.addEventListener('push', event => {
  const options = {
    icon: '/logo.webp',
    badge: '/favicon.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      { action: 'explore', title: 'Ver agora' },
      { action: 'close', title: 'Fechar' }
    ]
  };

  if (event.data) {
    try {
      const data = event.data.json();
      options.body = data.body || 'Nova atualização disponível';
      options.data = { ...options.data, ...data };
      
      event.waitUntil(
        self.registration.showNotification(data.title || 'VALUATION', options)
      );
    } catch (e) {
      const text = event.data.text();
      options.body = text;
      
      event.waitUntil(
        self.registration.showNotification('VALUATION', options)
      );
    }
  } else {
    options.body = 'Você tem uma nova atualização';
    
    event.waitUntil(
      self.registration.showNotification('VALUATION', options)
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Just close
  } else {
    // Default action - open app
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});