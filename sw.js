/* Régie offline: the first visit keeps the workspace and its fonts on the
   phone, so it opens in a hall with no signal. Pages are fetched fresh when
   the network is there (so a new version shows up at once) and fall back to
   the kept copy when it is not; everything else is served from the copy and
   refreshed in the background. Bump VERSION to drop old copies. */
const VERSION = 'regie-v1';
const SHELL = [
  './workspace.html',
  './workspace-i18n.js?v=20261030e',
  './index.html',
  './favicon.svg',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './manifest.webmanifest'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method!=='GET') return;
  const url = new URL(req.url);
  const isPage = req.mode==='navigate';
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if(url.origin!==location.origin && !isFont) return;

  if(isPage){
    // network first: always the newest version online, the kept one offline
    e.respondWith(
      fetch(req).then(res=>{
        const copy = res.clone();
        caches.open(VERSION).then(c=>c.put(req, copy));
        return res;
      }).catch(()=>caches.match(req, {ignoreSearch:true}).then(r=>r || caches.match('./workspace.html')))
    );
    return;
  }

  // files and fonts: the kept copy at once, refreshed in the background
  e.respondWith(
    caches.match(req).then(hit=>{
      const net = fetch(req).then(res=>{
        if(res && (res.ok || res.type==='opaque')){
          const copy = res.clone();
          caches.open(VERSION).then(c=>c.put(req, copy));
        }
        return res;
      }).catch(()=>hit);
      return hit || net;
    })
  );
});
