export const MOOD_OPTIONS = [
  { value: 1, emoji: '😔', label: 'とても悪い', color: '#E07B7B' },
  { value: 2, emoji: '😕', label: '悪い',       color: '#F5A623' },
  { value: 3, emoji: '😐', label: '普通',       color: '#F5D76E' },
  { value: 4, emoji: '🙂', label: '良い',       color: '#7ECBA1' },
  { value: 5, emoji: '😄', label: 'とても良い', color: '#64B6AC' },
];

export const ENERGY_OPTIONS = [
  { value: 1, emoji: '🪫', label: 'ぐったり', color: '#E07B7B' },
  { value: 2, emoji: '😴', label: 'だるい',   color: '#F5A623' },
  { value: 3, emoji: '😌', label: '普通',     color: '#F5D76E' },
  { value: 4, emoji: '⚡', label: '元気',     color: '#7ECBA1' },
  { value: 5, emoji: '🔥', label: '最高！',   color: '#64B6AC' },
];

const timeAccent = () => {
  const h = new Date().getHours();
  if (h >= 22 || h < 6)  return '#3D4B7A'; // 夜: 深いブルー
  if (h < 11)            return '#F9C66A'; // 朝: ゴールド
  if (h < 17)            return null;      // 昼: デフォルト
  return '#F4845F';                        // 夕: サンセット
};

const grad = (primary, defaultSecondary) => {
  const accent = timeAccent();
  return `linear-gradient(135deg, ${primary} 0%, ${accent ?? defaultSecondary} 100%)`;
};

export const analyzeState = (entries) => {
  if (entries.length === 0) {
    return {
      status: 'start', score: 3,
      emoji: '🌱', title: 'さあ、始めましょう',
      message: '今日の記録をつけて、あなたの状態を把握していきましょう。',
      advice: '毎日の小さな積み重ねが、大きな変化を生みます。',
      gradient: grad('#7C6FCD', '#A89FDE'),
      borderColor: '#7C6FCD',
    };
  }

  const recent    = entries.slice(-7);
  const avgMood   = recent.reduce((s, e) => s + e.mood,   0) / recent.length;
  const avgEnergy = recent.reduce((s, e) => s + e.energy, 0) / recent.length;
  const score     = (avgMood + avgEnergy) / 2;

  if (score >= 4.5) return {
    status: 'excellent', score, emoji: '🌟', title: '絶好調です！',
    message: '最近とても調子が良いですね。素晴らしい！',
    advice: 'この状態を維持するために、睡眠と水分補給も忘れずに。',
    gradient: grad('#64B6AC', '#95E1D3'), borderColor: '#64B6AC',
  };
  if (score >= 3.5) return {
    status: 'good', score, emoji: '😊', title: '調子は良好です',
    message: 'バランスが取れていますね。安定した状態です。',
    advice: '少しだけ自分を労ってあげましょう。好きなことをする時間を作ってみては？',
    gradient: grad('#7ECBA1', '#B8E4C9'), borderColor: '#7ECBA1',
  };
  if (score >= 2.5) return {
    status: 'tired', score, emoji: '😮‍💨', title: '少し疲れが溜まっています',
    message: '頑張りすぎていませんか？あなたの努力はちゃんと伝わっています。',
    advice: '深呼吸を3回してみましょう。今日は少し早めに休むのがおすすめです。',
    gradient: grad('#F5A623', '#F9C74F'), borderColor: '#F5A623',
  };
  if (score >= 1.5) return {
    status: 'stressed', score, emoji: '😔', title: 'ストレスが溜まっています',
    message: 'つらい時期かもしれませんが、気づけたことが大切な一歩です。',
    advice: '無理をしないでください。小さなことでも「できた」を大切にしましょう。',
    gradient: grad('#E07B7B', '#F5A5A5'), borderColor: '#E07B7B',
  };
  return {
    status: 'burnout', score, emoji: '🌧️', title: '休息が必要な状態です',
    message: 'よくここまで頑張ってきました。今は休むことが最優先です。',
    advice: '信頼できる人に話してみましょう。あなたは一人じゃありません。',
    gradient: grad('#9B7FA6', '#C3A8CE'), borderColor: '#9B7FA6',
  };
};

export const getStreak = (entries) => {
  if (entries.length === 0) return 0;
  const sorted = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));
  let streak = 0;
  for (let i = 0; i < sorted.length; i++) {
    const d = new Date(sorted[i].date);
    d.setHours(0, 0, 0, 0);
    const expected = new Date();
    expected.setHours(0, 0, 0, 0);
    expected.setDate(expected.getDate() - i);
    if (d.getTime() === expected.getTime()) streak++;
    else break;
  }
  return streak;
};

export const calculateImprovement = (entries) => {
  if (entries.length < 4) return null;
  const half = Math.min(7, Math.floor(entries.length / 2));
  const recent = entries.slice(-half);
  const older  = entries.slice(-half * 2, -half);
  if (older.length === 0) return null;
  const avg = (arr) => arr.reduce((s, e) => s + (e.mood + e.energy) / 2, 0) / arr.length;
  const pct = ((avg(recent) - avg(older)) / avg(older)) * 100;
  return Math.round(pct);
};

export const getLast7Days = (entries) => {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    const entry = entries.find(e => {
      const ed = new Date(e.date);
      ed.setHours(0, 0, 0, 0);
      return ed.getTime() === d.getTime();
    });
    const labels = ['日', '月', '火', '水', '木', '金', '土'];
    const isToday = i === 6;
    return { date: d, label: labels[d.getDay()], isToday, entry };
  });
};

const TIPS = [
  '「完璧」より「継続」が大事。今日も記録できたことを褒めてあげましょう。',
  '深呼吸を3回するだけで、気持ちが少し楽になります。',
  '水を一杯飲みましょう。小さなケアが心身を整えます。',
  '5分だけ外の空気を吸いに行ってみましょう。',
  '今日頑張ったことを一つ思い出してみてください。',
  '睡眠は最高のメンテナンス。早めに横になってみましょう。',
  '好きな音楽を一曲流してみてはいかがでしょう？',
  '自分に優しくすることも、大切なスキルのひとつです。',
];

export const getDailyTip = () => {
  const day = Math.floor(Date.now() / 86400000);
  return TIPS[day % TIPS.length];
};

export const getLast28Days = (entries) => {
  return Array.from({ length: 28 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (27 - i));
    d.setHours(0, 0, 0, 0);
    const entry = entries.find(e => {
      const ed = new Date(e.date + 'T00:00:00');
      ed.setHours(0, 0, 0, 0);
      return ed.getTime() === d.getTime();
    });
    return { date: d, entry, isToday: i === 27 };
  });
};

export const getLast7DaysScatter = (entries) => {
  return getLast7Days(entries)
    .filter(d => d.entry)
    .map(d => ({
      mood:    d.entry.mood,
      energy:  d.entry.energy,
      isToday: d.isToday,
    }));
};

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

const entriesInRange = (entries, daysAgoFrom, daysAgoTo) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return entries.filter(e => {
    const d = new Date(e.date);
    d.setHours(0, 0, 0, 0);
    const msAgo = today - d;
    const daysAgo = msAgo / 86400000;
    return daysAgo >= daysAgoTo && daysAgo <= daysAgoFrom;
  });
};

export const getWeeklySummary = (entries) => {
  const thisWeek = entriesInRange(entries, 6, 0);
  const lastWeek = entriesInRange(entries, 13, 7);

  if (thisWeek.length === 0) return null;

  const messages = [];

  // 記録日数メッセージ
  const days = thisWeek.length;
  if (days === 7)      messages.push({ icon: '🏆', text: '今週は毎日記録できました！本当に素晴らしい！' });
  else if (days >= 5)  messages.push({ icon: '🔥', text: `今週は${days}日間も記録できました！すごい！` });
  else if (days >= 3)  messages.push({ icon: '✨', text: `今週は${days}日間、自分と向き合えました。いい調子です。` });
  else                 messages.push({ icon: '🌱', text: `今週も${days}日間、ちゃんと記録できています。` });

  // 先週比メッセージ
  if (lastWeek.length >= 2 && thisWeek.length >= 2) {
    const avg = (arr, key) => arr.reduce((s, e) => s + e[key], 0) / arr.length;
    const moodDiff = avg(thisWeek, 'mood') - avg(lastWeek, 'mood');
    const smileyThis = thisWeek.filter(e => e.mood >= 4).length;
    const smileyLast = lastWeek.filter(e => e.mood >= 4).length;
    const smileyDiff = smileyThis - smileyLast;

    if (moodDiff > 0.3) {
      if (smileyDiff > 0) {
        messages.push({ icon: '😊', text: `先週より笑顔のマークが${smileyDiff}つ増えています！` });
      } else {
        messages.push({ icon: '📈', text: '先週より気分のスコアが上がっています！' });
      }
    } else if (moodDiff < -0.3) {
      messages.push({ icon: '💪', text: 'つらい時期もあるけれど、記録できていることが大切な一歩です。' });
    } else {
      messages.push({ icon: '😌', text: '先週と同じくらい、安定した一週間でした。' });
    }
  } else if (lastWeek.length === 0 && thisWeek.length >= 3) {
    messages.push({ icon: '🎉', text: 'この調子で記録を続けると、来週との比較も見えてきます！' });
  }

  // 今週一番よかった日
  if (thisWeek.length >= 3) {
    const best = thisWeek.reduce((a, b) =>
      (a.mood + a.energy > b.mood + b.energy ? a : b)
    );
    messages.push({
      icon: '⭐',
      text: `今週一番元気だったのは${DAY_NAMES[new Date(best.date).getDay()]}曜日です。`,
    });
  }

  return messages.slice(0, 3);
};
