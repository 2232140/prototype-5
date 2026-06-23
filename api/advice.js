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

1. 【共感】: まずユーザーの立場に完全に立ち、気持ちを全力で肯定・共感する（「それはつらかったね」「悲しくなるよね」など）。
2. 【プラスアルファ】: 単なるオウム返し（共感のみ）で終わらせず、以下のいずれかを1つ自然に盛り込む：
   - 【リフレーミング】: 悩みの裏にある「ユーザーの頑張りや優しさ」を肯定的に捉え直す（例：「それだけ大切に思っているんだね」「そこまで頑張ったのがすごいよ」）
   - 【小さなセルフケア】: 問題の根本解決ではなく、ユーザーが今すぐできる心を労わる小さな行動を提案する（例：「美味しいものでも食べてね」「今日はゆっくりお休みしてね」）
   - 【寄り添う問いかけ】: 「何があったか話したくなったら聞くよ」など、心に寄り添う問いかけをする
3. 【禁止事項】: 説教や、一方的で重たい解決策の提示（「彼氏と話し合いなさい」「学校に行きなさい」など）は絶対にしない。
4. 【トーン】: 友人のように自然な口語体で話す（「〜だよ」「〜だね」「〜じゃん」）。
5. 【制限】: 120文字以内でまとめる。日本語だけで返す。前置きは不要。`;

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
