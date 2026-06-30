import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { subscription, notificationTime, userId } = req.body;
  if (!subscription?.endpoint || !userId) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id:           userId,
        endpoint:          subscription.endpoint,
        p256dh:            subscription.keys.p256dh,
        auth:              subscription.keys.auth,
        notification_time: notificationTime || '21:00',
      },
      { onConflict: 'user_id' }
    );

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
