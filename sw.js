// オフラインでも遊べるように、全ファイルを最初に保存しておく
const CACHE = 'kizami-pad-v18';
const FILES = ['./', 'index.html', 'app.css', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  ...['trap-snare', 'trap-clap', 'trap-hat_closed', 'perc-tom_low', 'perc-tom_high', 
    'perc-rim', 'perc-shaker', 'perc-clave', 'perc-cowbell', 'house-clap', 'perc-conga', 'perc-snap', 'perc-bass', 'perc-dive', 'perc-kick_punch'].map((n) => `samples/${n}.wav`)];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  // つながる時は最新を取り、取れない時だけ保存分を使う（更新が1回遅れで反映される問題を避ける）
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((res) => { const c = res.clone(); caches.open(CACHE).then((ch) => ch.put(e.request, c)); return res; }).catch(() => caches.match(e.request)));
});
