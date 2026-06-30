import React, { useState, useEffect } from 'react';
import { saveEntry, getTodayEntry, saveWeather } from '../utils/storage';
import { MOOD_OPTIONS, ENERGY_OPTIONS } from '../utils/analysis';
import { getWeather } from '../utils/weather';
import HelpTooltip from './HelpTooltip';

const MESSAGES = [
  '記録してくれてありがとう！\nあなたのことを、ちゃんと知っていけるね。🌱',
  '今日も記録できたね！\nその積み重ねが、あなたの力になっていくよ。✨',
  'えらい！継続は力なり。\nあなたは今日も一歩前進した。🎉',
  '自分の状態に気づくこと、\nそれだけで十分すごいことだよ。🌸',
];

function SliderQuestion({ label, value, onChange, options, color }) {
  const idx     = Math.min(options.length - 1, Math.max(0, Math.round(value) - 1));
  const current = options[idx];
  const fill    = `${((value - 1) / 4) * 100}%`;

  return (
    <div className="slider-block">
      <h2 className="step-q">{label}</h2>
      <div className="slider-emoji-display">
        <span className="slider-emoji-big">{current.emoji}</span>
        <span className="slider-label-text" style={{ color }}>{current.label}</span>
      </div>
      <input
        type="range"
        min="1" max="5" step="0.1"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="mood-range"
        style={{ '--fill': fill, '--color': color }}
      />
      <div className="slider-ticks">
        {[1,2,3,4,5].map(v => <span key={v} className="slider-tick" />)}
      </div>
      <div className="slider-snap-btns">
        {options.map(o => (
          <button
            key={o.value}
            className={`snap-btn ${Math.round(value) === o.value ? 'active' : ''}`}
            style={Math.round(value) === o.value ? { borderColor: color, background: color + '22' } : {}}
            onClick={() => onChange(o.value)}
          >
            {o.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CheckIn({ onNavigate }) {
  const [mood, setMood]     = useState(3);
  const [energy, setEnergy] = useState(3);
  const [memo, setMemo]     = useState('');
  const [done, setDone]     = useState(false);
  const [msg, setMsg]       = useState('');
  const [ripple, setRipple] = useState(false);

  useEffect(() => {
    (async () => {
      const today = await getTodayEntry();
      if (today) {
        setMood(Number(today.mood));
        setEnergy(Number(today.energy));
        setMemo(today.memo || '');
      }
      setMsg(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
    })();
    // 天気を裏側で取得して保存（失敗しても無視）
    getWeather().then(saveWeather).catch(() => {});
  }, []);

  const submit = () => {
    setRipple(true);
    setTimeout(async () => {
      await saveEntry({ mood, energy, memo });
      setDone(true);
    }, 650);
    setTimeout(() => setRipple(false), 1500);
  };

  return (
    <div className={`screen ${done ? '' : 'checkin-screen'}`}>
      {ripple && (
        <div className="ripple-overlay">
          <div className="ripple-circle r1" />
          <div className="ripple-circle r2" />
          <div className="ripple-circle r3" />
        </div>
      )}

      {done ? (
        <div className="checkin-done">
          <div className="done-emoji-big">🎉</div>
          <h2 className="done-title-big">記録完了！</h2>
          <p className="done-msg">{msg}</p>
          <button className="primary-btn full" onClick={() => onNavigate('home')}>
            ホームに戻る
          </button>
        </div>
      ) : (
        <>
          <div className="checkin-header">
            <h1 className="checkin-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              今日の記録
              <HelpTooltip text="毎日の気分と体調を1〜5のスライダーで記録します。一言メモも残せます。記録が続くと、グラフで変化を振り返れます。" />
            </h1>
          </div>

          <div className="checkin-sliders">
            <SliderQuestion
              label="今日の気分は？"
              value={mood}
              onChange={setMood}
              options={MOOD_OPTIONS}
              color="#7C6FCD"
            />
            <div className="slider-divider" />
            <SliderQuestion
              label="体の調子は？"
              value={energy}
              onChange={setEnergy}
              options={ENERGY_OPTIONS}
              color="#64B6AC"
            />
            <div className="slider-divider" />
            <div className="slider-memo-block">
              <h2 className="step-q">
                一言メモ <span className="step-hint-inline">（任意）</span>
              </h2>
              <textarea
                className="memo-area"
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder="今日感じたことを自由に書いてみましょう"
                rows={3}
              />
            </div>
            <button className="primary-btn full" onClick={submit} style={{ marginTop: 8 }}>
              記録する ✓
            </button>
          </div>
        </>
      )}
    </div>
  );
}
