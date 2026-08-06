const CACHE_NAME = 'on108yoga-v10';

// 앱 시작 시 오프라인/PWA 환경에서도 꼭 필요한 핵심 파일 목록
const urlsToCache = [
  './',
  './index.html',
  './su_hp.css?v=2.0',
  './manifest.json',
  './images/micon_108.png'
];

// 1. 서비스 워커 설치 및 핵심 리소스 캐싱
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installed');
  self.skipWaiting(); // 새 서비스 워커가 즉시 활성화되도록 설정
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(urlsToCache);
    })
  );
});

// 2. 오래된 구버전 캐시 정리
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. 파일 요청 처리 (네트워크 우선, 실패 시 캐시에서 제공)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 정상 응답을 받았을 경우 캐시 최신화
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // 네트워크 연결 실패 시 캐시된 파일 제공 (CSS 깨짐 방지)
        return caches.match(event.request);
      })
  );
});
