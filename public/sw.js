const CACHE = 'kokoro-v1';

// ===== インストール: index.html のみキャッシュ =====
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['/'])).then(() => self.skipWaiting())
  );
});

// ===== アクティベート: 古いキャッシュを削除 =====
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ===== フェッチ戦略 =====
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API・外部リクエストはキャッシュしない
  if (url.pathname.startsWith('/api/') || url.origin !== location.origin) return;

  // ナビゲーション（HTML）: オフライン時にキャッシュから返す
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/'))
    );
    return;
  }

  // 静的アセット: キャッシュ優先、なければ取得してキャッシュ
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      });
    })
  );
});

// ===== プッシュ通知受信 =====
self.addEventListener('push', e => {
  const data = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(data.title ?? 'こころの記録 🌱', {
      body:     data.body ?? '今日の気分・体調を記録しましょう。',
      icon:     '/icon.svg',
      badge:    '/icon.svg',
      tag:      'kokoro-reminder',
      renotify: true,
      data:     { url: '/' },
    })
  );
});

// ===== 通知タップ: アプリを開く =====
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      const existing = wins.find(w => w.url.startsWith(location.origin));
      if (existing) return existing.focus();
      return clients.openWindow(e.notification.data?.url ?? '/');
    })
  );
});
