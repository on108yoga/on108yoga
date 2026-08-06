// 🎯 버전을 v10 -> v11로 올려서 브라우저가 새 서비스 워커를 감지하게 합니다.
const CACHE_NAME = 'on108yoga-v11';

// 관리자 페이지 관련 중요 JS/HTML 파일들까지 포함
const urlsToCache = [
  './',
  './index.html',
  './admin.html',
  './admin.js',
  './firebase.js',
  './auth.js',
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

// 2. 오래된 구버전 캐시 정리 및 제어권 즉시 확보
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
    }).then(() => self.clients.claim()) // 현재 열려있는 페이지들에 즉시 새 서비스워커 적용
  );
});

// 3. 파일 요청 처리 (네트워크 우선)
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 🎯 Firebase / Chrome Ext / non-GET / non-HTTP 요청은 캐시하지 않고 네트워크로 직행
  if (
    req.method !== 'GET' ||
    !req.url.startsWith('http') ||
    req.url.includes('firestore.googleapis.com') ||
    req.url.includes('identitytoolkit.googleapis.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((response) => {
        // 정상 네트워크 응답(200)을 받으면 캐시 업데이트
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // 오프라인 상태이거나 네트워크 에러 발생 시 캐시된 파일 제공
        return caches.match(req);
      })
  );
});
