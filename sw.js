// sw.js 파일 내부 상단
const CACHE_NAME = 'on108yoga-v2'; // 기존 -v1 또는 이전 이름을 -v2, -v3 등으로 변경

self.addEventListener('install', (e) => {
  console.log('Service Worker Installed');
});

self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request));
});
