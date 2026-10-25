/* DayBook — 오프라인에서도 앱이 열리게 하는 파일입니다. (일기 데이터는 기기의 IndexedDB에 따로 저장돼요) */
const CACHE = 'daybook-shell-v3';
const SHARE = 'daybook-share';
const SHELL = ['./', 'index.html'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => fetch(u, { cache: 'reload' }).then(r => { if (r.ok) return c.put(u, r); }).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== SHARE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const fromCache = async r => (await caches.match(r, { ignoreSearch: true })) || (await caches.match('index.html')) || (await caches.match('./'));
self.addEventListener('fetch', e => {
  const r = e.request;
  /* 갤러리 등에서 '공유'로 보낸 사진을 받아 잠시 보관 → 앱이 열리면 글쓰기 화면에 붙여요 */
  if (r.method === 'POST' && new URL(r.url).origin === location.origin && new URL(r.url).searchParams.has('share')) {
    e.respondWith((async () => {
      const u = new URL(r.url);
      try {
        const fd = await r.formData(), files = fd.getAll('photos').filter(f => f && typeof f !== 'string');
        await caches.delete(SHARE);
        const c = await caches.open(SHARE);
        let i = 0;
        for (const f of files) await c.put(new Request(new URL('__share/' + (i++), self.registration.scope).href), new Response(f, { headers: { 'X-Name': encodeURIComponent(f.name || 'photo'), 'X-Type': f.type || '', 'X-Mod': String(f.lastModified || 0), 'Content-Type': f.type || 'application/octet-stream' } }));
      } catch (err) {}
      return Response.redirect(u.origin + u.pathname, 303);
    })());
    return;
  } if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  const nav = r.mode === 'navigate';
  e.respondWith((async () => {
    try {
      const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), nav ? 4000 : 8000);
      const res = await fetch(r, { signal: ctl.signal }); clearTimeout(tm);
      if (res.ok) { const c = await caches.open(CACHE); c.put(nav ? 'index.html' : r, res.clone()); }
      return res;
    } catch (err) {
      const m = await fromCache(r); if (m) return m;
      throw err;
    }
  })());
});
