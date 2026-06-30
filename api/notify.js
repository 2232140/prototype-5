import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  // JST で現在時刻を HH:MM 形式に変換
  const jst  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const hhmm = `${String(jst.getHours()).padStart(2, '0')}:${String(jst.getMinutes()).padStart(2, '0')}`;

  // 通知時刻が一致するサブスクリプションを取得
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('notification_time', hhmm);

  if (error) return res.status(500).json({ error: error.message });
  if (!subs?.length) return res.status(200).json({ sent: 0, time: hhmm });

  const payload = JSON.stringify({
    title: 'こころの記録 🌱',
    body:  '今日の気分・体調を記録しましょう。',
  });

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        .catch(async err => {
          // 410 = サブスクリプション失効 → 削除
          if (err.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        })
    )
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  return res.status(200).json({ sent, total: subs.length, time: hhmm });
}
