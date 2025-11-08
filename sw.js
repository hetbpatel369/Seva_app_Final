// Service Worker for Seva App PWA

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(self.clients.claim());
});

// Cache important files
self.addEventListener('fetch', (event) => {
  // Let the app work offline by not blocking network requests
  event.respondWith(fetch(event.request));
});


