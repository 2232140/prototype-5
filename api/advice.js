export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken  = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    return res.status(503).json({ error: 'AIアドバイス機能は現在利用できません。' });
  }

  const { stateTitle, recentSummary, moodScore, todayNote, weather } = req.body;
  if (!stateTitle) {
    return res.status(400).json({ error: '状態データが不足しています。' });
  }

  const score      = Number(moodScore) || 3;
  const hasConcern = Boolean(todayNote?.trim());

  // 天気コンテキスト文字列（気圧が低い場合は追加ヒント）
  const weatherCtx = weather
    ? `【今日の天気】${weather.emoji} ${weather.label} / ${weather.temp}°C / 気圧 ${weather.pressure} hPa${
        weather.pressure < 1013
          ? '（低気圧：頭痛・倦怠感が出やすい気象条件です）'
          : ''
      }`
    : null;

  let messages;

  if (hasConcern) {
    // ── モード1: 個人的な悩みモード（few-shot） ──
    // 複雑な指示より「こういう例のように返して」の方が Llama には効果的
    messages = [
      {
        role: 'system',
        content:
          'あなたは「こころの記録」アプリのAIアシスタントです。' +
          'ユーザーの悩みに共感しつつ、気持ちが少し楽になるような一言を添えてください。' +
          '日本語のみ・120文字以内・友人のような口語体（〜だよ・〜だね）・説教や重い解決策は禁止。',
      },
      // ── few-shot 例 ──
      { role: 'user',      content: '学校に行きたくない' },
      { role: 'assistant', content: '毎日頑張ってきた分、疲れてるよね。今日くらいゆっくり自分を甘やかしていいと思うよ。' },

      { role: 'user',      content: '上司に怒られた' },
      { role: 'assistant', content: 'それはつらかったね。でも一生懸命やってた証拠だよ。今日はおいしいもの食べて自分を労ってあげて。' },

      { role: 'user',      content: '彼氏が返信してくれない' },
      { role: 'assistant', content: '不安になるよね…。大切に思ってるからこそ気になるんだよ。今は好きなことして自分を大事にしてね。' },

      { role: 'user',      content: '友達に無視された気がする' },
      { role: 'assistant', content: 'それは悲しかったね。あなたが悪いわけじゃないから自分を責めないで。好きな音楽でも聴いてゆっくりしてね。' },

      { role: 'user',      content: 'バイトでミスをしてしまった' },
      { role: 'assistant', content: 'ミスって落ち込むよね、わかるよ。でも気にするってことは真剣にやってた証拠だよ。次に活かせれば大丈夫。' },

      // ── 実際のユーザー入力 ──
      {
        role: 'user',
        content: weatherCtx
          ? `${weatherCtx}\n${todayNote.trim()}`
          : todayNote.trim(),
      },
    ];
  } else {
    // ── モード2: 気分・体調ベースモード（few-shot） ──
    const weatherHint = weatherCtx
      ? `\n${weatherCtx}${weather?.pressure < 1013 ? '\n低気圧の影響でだるさや頭痛が出やすい状況です。天気のせいかもしれないと一言添えてください。' : ''}`
      : '';

    const moodSystemPrompt = score <= 1.5
      ? 'あなたは「こころの記録」アプリのAIアシスタントです。ユーザーは今とてもつらい状態です。アドバイスは不要で、ただ寄り添う温かい言葉を日本語のみ・100文字以内で返してください。前置き不要。'
      : score <= 2.5
      ? 'あなたは「こころの記録」アプリのAIアシスタントです。ユーザーの気分・体調の記録を読んで、友人のように共感しながら小さな提案を一つだけ添えてください。日本語のみ・120文字以内・前置き不要。'
      : 'あなたは「こころの記録」アプリのAIアシスタントです。ユーザーの気分・体調の記録を読んで、前向きな一言を友人のような口調で返してください。日本語のみ・120文字以内・前置き不要。';

    messages = [
      { role: 'system', content: moodSystemPrompt },
      {
        role: 'user',
        content:
          `【現在の状態】${stateTitle}\n【最近7日間の記録】${recentSummary}${weatherHint}\nこのユーザーへの一言をお願いします。`,
      },
    ];
  }

  const cfResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ messages, max_tokens: 200 }),
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
