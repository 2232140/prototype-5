export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken  = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    return res.status(503).json({ error: 'AIアドバイス機能は現在利用できません。' });
  }

  const { stateTitle, recentSummary, moodScore, todayNote } = req.body;
  if (!stateTitle) {
    return res.status(400).json({ error: '状態データが不足しています。' });
  }

  const score = Number(moodScore) || 3;

  const systemPrompt = score <= 1.5
    ? `あなたは「こころの記録」という日本のメンタルヘルスアプリのAIアシスタントです。
ユーザーは今とてもつらい状態です。以下のルールを必ず守ってください。
- アドバイスや「〜してみては」という提案は一切しない
- ユーザーの気持ちにただ寄り添い、共感の言葉だけを返す
- 「それはつらいね」「一人じゃないよ」のような温かい言葉を使う
- 必ず日本語だけで返す（英語禁止）
- 120文字以内でまとめる
- 「はい」「もちろん」「わかりました」などの前置きは不要。すぐ本題を返す`
    : score <= 2.5
    ? `あなたは「こころの記録」という日本のメンタルヘルスアプリのAIアシスタントです。
ユーザーの気分・体調の記録を読んで、友人のように自然な会話口調でメッセージを送ってください。以下のルールを必ず守ってください。
- 必ず日本語だけで返す（英語禁止）
- 120文字以内でまとめる
- 上から目線にならない。「〜すべき」「〜しなければ」は使わない
- 共感してから、具体的なひと言アドバイスをする
- 「はい」「もちろん」「わかりました」などの前置きは不要。すぐ本題を返す`
    : `あなたは「こころの記録」という日本のメンタルヘルスアプリのAIアシスタントです。
ユーザーの気分・体調の記録を読んで、前向きで具体的なメッセージを友人のような口調で送ってください。以下のルールを必ず守ってください。
- 必ず日本語だけで返す（英語禁止）
- 120文字以内でまとめる
- 最近の記録の傾向に触れながら、具体的な一言を返す
- 「はい」「もちろん」「わかりました」などの前置きは不要。すぐ本題を返す`;

  const userContent = [
    `【現在の状態】${stateTitle}`,
    `【最近7日間の記録】${recentSummary}`,
    todayNote ? `【ユーザーのひとこと】${todayNote}` : null,
    `\n上記を踏まえて、このユーザーへの一言を日本語で返してください。`,
  ].filter(Boolean).join('\n');

  const cfResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userContent },
        ],
        max_tokens: 200,
      }),
    }
  );

  if (!cfResponse.ok) {
    const err = await cfResponse.json().catch(() => ({}));
    return res.status(cfResponse.status).json({
      error: err.errors?.[0]?.message || 'AIエラーが発生しました。',
    });
  }

  const data = await cfResponse.json();
  let advice = data.result?.response?.trim();
  if (!advice) {
    return res.status(500).json({ error: 'アドバイスの生成に失敗しました。' });
  }

  // 英語の前置き・定型句を除去
  advice = advice
    .replace(/^(Here'?s?|Sure[,!]?|Of course[,!]?|Certainly[,!]?|I understand[,!]?)[^\n]*\n?/i, '')
    .replace(/^(はい[、。]?|もちろん[、。]?|わかりました[、。]?|承知しました[、。]?)/,  '')
    .replace(/^「/, '').replace(/」$/, '')
    .trim();

  return res.status(200).json({ advice });
}
