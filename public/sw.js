const CACHE_NAME = 'lizalis-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Принудительно завершаем ожидание старой версии
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // Немедленно берем под контроль все открытые вкладки
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Пропускаем внешние запросы и API
  if (!event.request.url.startsWith(self.location.origin) || 
      event.request.url.includes('/analyze') || 
      event.request.url.includes('/speak')) {
    return;
  }

  // Стратегия Network First: сначала идем в сеть, если нет связи — в кэш
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});