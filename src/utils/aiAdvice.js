const MOOD_LABELS = ['', 'とても悪い', '悪い', '普通', '良い', 'とても良い'];

export const getAIAdvice = async (entries, state, todayNote = null, weather = null) => {
  const recent = entries.slice(-7);
  const recentSummary = recent.length > 0
    ? recent.map(e =>
        `${new Date(e.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}: 気分=${MOOD_LABELS[Math.round(e.mood)]}, 体調=${MOOD_LABELS[Math.round(e.energy)]}`
      ).join(' / ')
    : 'まだ記録がありません';

  const res = await fetch('/api/advice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stateTitle: state.title, recentSummary, moodScore: state.score ?? 3, todayNote, weather }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'AIアドバイスの取得に失敗しました。');
  }
  return data.advice;
};
