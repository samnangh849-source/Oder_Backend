const CACHE_NAME = 'osystem-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// --- Local HLS Proxy Logic ---
function getProxyPrefix() {
  return new URL('local-proxy/', self.registration.scope).pathname;
}

async function handleHLSProxy(request) {
  const proxyPrefix = getProxyPrefix();
  const urlObj = new URL(request.url);
  const path = urlObj.pathname;
  const targetUrlStr = urlObj.searchParams.get('url');
  const referer = urlObj.searchParams.get('referer');

  if (!targetUrlStr) {
    return new Response('Missing url parameter', { status: 400 });
  }

  const targetUrl = new URL(targetUrlStr);
  const headers = new Headers({
    'User-Agent': navigator.userAgent,
    'Accept': '*/*',
  });

  if (referer) {
    headers.set('Referer', referer);
  } else {
    headers.set('Referer', targetUrl.origin);
  }

  // Forward Range header for segments
  const range = request.headers.get('Range');
  if (range) {
    headers.set('Range', range);
  }

  try {
    // We use AllOrigins as a primary CORS bypass for the client-side proxy
    // because most M3U8 sources don't have permissive CORS headers.
    const bypassUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrlStr)}`;
    
    const response = await fetch(bypassUrl, { headers });
    
    if (!response.ok) {
        // Fallback to direct fetch if allorigins fails (some sources might have CORS)
        const directResponse = await fetch(targetUrlStr, { headers });
        if (!directResponse.ok) return directResponse;
        return processResponse(directResponse, targetUrl, path, referer, proxyPrefix);
    }

    return processResponse(response, targetUrl, path, referer, proxyPrefix);
  } catch (error) {
    return new Response(`Proxy Error: ${error.message}`, { status: 500 });
  }
}

async function processResponse(response, targetUrl, path, referer, proxyPrefix) {
    if (path.includes('/m3u8')) {
        let content = await response.text();
        const isMaster = content.includes('#EXT-X-STREAM-INF');
        const lines = content.split(/\r?\n/);
        
        const rewrittenLines = lines.map(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) {
                if (trimmed.includes('URI="')) {
                    return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
                        const absUri = new URL(uri, targetUrl.href).href;
                        const isPlaylist = absUri.toLowerCase().includes('.m3u8') || isMaster;
                        const type = isPlaylist ? 'm3u8' : 'ts';
                        return `URI="${proxyPrefix}${type}?url=${encodeURIComponent(absUri)}&referer=${encodeURIComponent(referer || '')}"`;
                    });
                }
                return line;
            }
            
            const absUrl = new URL(trimmed, targetUrl.href).href;
            const isPlaylist = absUrl.toLowerCase().includes('.m3u8') || isMaster;
            const type = isPlaylist ? 'm3u8' : 'ts';
            return `${proxyPrefix}${type}?url=${encodeURIComponent(absUrl)}&referer=${encodeURIComponent(referer || '')}`;
        });

        return new Response(rewrittenLines.join('\n'), {
            headers: {
                'Content-Type': 'application/vnd.apple.mpegurl',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    // For TS segments and other files, just forward the response
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    return newResponse;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const proxyPrefix = getProxyPrefix();
  
  // Handle local proxy requests
  if (url.pathname.startsWith(proxyPrefix)) {
    event.respondWith(handleHLSProxy(event.request));
    return;
  }

  // Simple network-first strategy for API calls, cache-first for static assets
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Handle Notification Clicks
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/icon.png',
      badge: data.badge || '/badge.png',
      data: { url: data.url || '/' }
    };
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});
