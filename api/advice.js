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
  const hasConcern = Boolean(todayNote?.trim());

  // ── モード1: 個人的な悩みへの共感モード ──────────────────────────────
  // todayNote がある場合は気分スコアを無視し、悩みに全力で向き合う
  const personalSupportPrompt = `あなたは「こころの記録」アプリの、ユーザーの一番の味方であるAIアシスタントです。
ユーザーが今日あった出来事や悩みを話してくれました。
以下のルールを必ず守ってください。
- ユーザーの立場に完全に立ち、ユーザーの気持ちを全力で肯定・共感する
- 「それはつらかったね」「あなたは悪くないよ」「よく頑張ったじゃん」のような言葉で寄り添う
- 相手（上司・彼氏・友人など）を直接批判するのではなく、ユーザーの気持ちを受け止める表現をする
- 解決策やアドバイスは不要。まず気持ちを受け止めることに集中する
- 友人のように自然な口語体で話す（「〜だよ」「〜だね」「〜じゃん」）
- 必ず日本語だけで返す（英語禁止）
- 120文字以内でまとめる
- 「はい」「もちろん」などの前置きは不要。すぐ共感の言葉から始める`;

  // ── モード2: 気分・体調ベースのアドバイスモード ──────────────────────
  // todayNote がない場合は記録データをもとに返答する
  const moodAdvicePrompt = score <= 1.5
    ? `あなたは「こころの記録」という日本のメンタルヘルスアプリのAIアシスタントです。
ユーザーは今とてもつらい状態です。以下のルールを必ず守ってください。
- アドバイスや「〜してみては」という提案は一切しない
- ユーザーの気持ちにただ寄り添い、共感の言葉だけを返す
- 「それはつらいね」「一人じゃないよ」のような温かい言葉を使う
- 必ず日本語だけで返す（英語禁止）
- 120文字以内でまとめる
- 前置きは不要。すぐ本題を返す`
    : score <= 2.5
    ? `あなたは「こころの記録」という日本のメンタルヘルスアプリのAIアシスタントです。
ユーザーの気分・体調の記録を読んで、友人のように自然な会話口調でメッセージを送ってください。
以下のルールを必ず守ってください。
- 必ず日本語だけで返す（英語禁止）
- 120文字以内でまとめる
- 上から目線にならない。「〜すべき」「〜しなければ」は使わない
- 共感してから、ひと言だけ具体的な提案をする
- 前置きは不要。すぐ本題を返す`
    : `あなたは「こころの記録」という日本のメンタルヘルスアプリのAIアシスタントです。
ユーザーの気分・体調の記録を読んで、前向きで具体的なメッセージを友人のような口調で送ってください。
以下のルールを必ず守ってください。
- 必ず日本語だけで返す（英語禁止）
- 120文字以内でまとめる
- 最近の記録の傾向に触れながら、具体的な一言を返す
- 前置きは不要。すぐ本題を返す`;

  const systemPrompt = hasConcern ? personalSupportPrompt : moodAdvicePrompt;

  // ユーザーメッセージもモードで切り替える
  const userContent = hasConcern
    ? `ユーザーが話してくれた悩み・出来事：「${todayNote}」\n\n（参考）現在の状態：${stateTitle}\n\nこのユーザーの気持ちに寄り添い、ユーザーの味方として一言だけ返してください。`
    : [
        `【現在の状態】${stateTitle}`,
        `【最近7日間の記録】${recentSummary}`,
        `\nこのユーザーへの励ましの一言を日本語で返してください。`,
      ].join('\n');

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
    .replace(/^(はい[、。]?|もちろん[、。]?|わかりました[、。]?|承知しました[、。]?)/, '')
    .replace(/^「/, '').replace(/」$/, '')
    .trim();

  return res.status(200).json({ advice });
}
