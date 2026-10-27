const CACHE='lh-trading-assets-v1';
const ASSETS=['/icon-192.png','/icon-512.png','/apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('lh-trading-assets-')&&key!==CACHE).map(key=>caches.delete(key))))));
// Never cache pages, account responses, quotes, orders or any other personal data.
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(url.origin===self.location.origin&&ASSETS.includes(url.pathname)&&event.request.method==='GET')event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)))});
