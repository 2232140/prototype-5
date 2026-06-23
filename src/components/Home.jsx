import React, { useState, useEffect, useRef } from 'react';
import { getEntries, getTodayEntry, getSettingsWithDefaults, getLetters, saveLetter, wroteLetterToday } from '../utils/storage';
import {
  analyzeState, getStreak, calculateImprovement, getDailyTip,
  getWeeklySummary, MOOD_OPTIONS, ENERGY_OPTIONS,
} from '../utils/analysis';
import { getAIAdvice } from '../utils/aiAdvice';
import HelpTooltip from './HelpTooltip';

function Collapsible({ title, helpText, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card collapsible-section">
      <button className="collapsible-toggle" onClick={() => setOpen(o => !o)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {title}
          {helpText && <HelpTooltip text={helpText} />}
        </span>
        <span className={`collapsible-chevron${open ? ' open' : ''}`}>›</span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

export default function Home({ onNavigate, providerToken = null }) {
  const [entries, setEntries]         = useState([]);
  const [todayEntry, setTodayEntry]   = useState(null);
  const [settings, setSettings]       = useState({ name: '' });
  const [breathing, setBreathing]     = useState(false);
  const [breathPhase, setBreathPhase] = useState('inhale');
  const [breathRound, setBreathRound] = useState(0);
  const cancelRef                     = useRef(false);
  const [aiAdvice, setAiAdvice]       = useState('');
  const [aiLoading, setAiLoading]     = useState(false);
  const [aiError, setAiError]         = useState('');
  const [todayNote, setTodayNote]     = useState('');
  const [letterText, setLetterText]   = useState('');
  const [letterSent, setLetterSent]   = useState(false);
  const [letterDismissed, setLetterDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      setEntries(await getEntries());
      setTodayEntry(await getTodayEntry());
      setSettings(getSettingsWithDefaults());
    })();
  }, []);

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const s = getSettingsWithDefaults();
    if (!s.notificationEnabled) return;

    const [h, m] = s.notificationTime.split(':').map(Number);
    const now    = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);

    const fire = async () => {
      const today = await getTodayEntry();
      if (!today) new Notification('こころの記録 🌱', { body: '今日の記録がまだです。1分で完了します！' });
    };

    const msUntil = target - now;
    if (msUntil > 0) {
      const timer = setTimeout(fire, msUntil);
      return () => clearTimeout(timer);
    }
    fire();
  }, []);

  const state         = analyzeState(entries);
  const streak        = getStreak(entries);
  const improve       = calculateImprovement(entries);
  const tip           = getDailyTip();
  const weeklySummary = getWeeklySummary(entries);
  const now           = new Date();
  const hour          = now.getHours();
  const greeting      = hour < 12 ? 'おはようございます' : hour < 17 ? 'こんにちは' : 'こんばんは';
  const dateLabel     = now.toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  });

  const startBreathing = async () => {
    cancelRef.current = false;
    setBreathing(true);
    setBreathRound(0);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 3; i++) {
      if (cancelRef.current) break;
      setBreathPhase('inhale');  await sleep(4000);
      if (cancelRef.current) break;
      setBreathPhase('hold');   await sleep(7000);
      if (cancelRef.current) break;
      setBreathPhase('exhale'); await sleep(8000);
      if (!cancelRef.current) setBreathRound(i + 1);
    }
    if (!cancelRef.current) setBreathing(false);
  };

  const stopBreathing = () => {
    cancelRef.current = true;
    setBreathing(false);
    setBreathRound(0);
  };

  const handleAIAdvice = async () => {
    setAiLoading(true);
    setAiError('');
    setAiAdvice('');
    try {
      const advice = await getAIAdvice(entries, state, todayNote.trim() || null);
      setAiAdvice(advice);
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const breathLabel = { inhale: '吸う (4秒)', hold: '止める (7秒)', exhale: '吐く (8秒)' }[breathPhase];

  return (
    <div className="screen home-screen">

      {/* ヘッダー */}
      <div className="home-header" style={{ background: state.gradient }}>
        <div>
          <p className="greeting">{greeting}{settings.name ? `、${settings.name}さん` : ''}</p>
          <p className="date-str">{dateLabel}</p>
        </div>
        <div className="header-state-emoji">{state.emoji}</div>
      </div>

      {/* ① 今日の記録ボタン — 最上部・最大サイズ */}
      {!todayEntry ? (
        <button className="cta-btn" onClick={() => onNavigate('checkin')}>
          <span className="cta-icon">✏️</span>
          <div className="cta-text">
            <div className="cta-main">今日の記録をする</div>
            <div className="cta-sub">1分以内で完了します</div>
          </div>
          <span className="cta-arrow">›</span>
        </button>
      ) : (
        <div className="done-banner">
          <span>✅</span>
          <div>
            <div className="done-main">今日の記録は完了しています！</div>
            <div className="done-emojis">
              気分 {MOOD_OPTIONS[Math.round(todayEntry.mood) - 1]?.emoji}
              {'　'}体調 {ENERGY_OPTIONS[Math.round(todayEntry.energy) - 1]?.emoji}
            </div>
          </div>
          <button className="edit-link" onClick={() => onNavigate('checkin')}>修正</button>
        </div>
      )}

      {/* ② 状態カード + AIアドバイス */}
      <div className="card state-card" style={{ borderLeftColor: state.borderColor }}>
        <h2 className="state-title">{state.title}</h2>
        <p className="state-message">{state.message}</p>
        <div className="divider" />
        <p className="state-advice">💡 {state.advice}</p>
        <div className="ai-advice-section">
          <div className="divider" />
          <span className="ai-advice-label">
            💬 AIに相談する
            <HelpTooltip text="気分・体調の記録をもとに、AIがあなたの状態に合ったアドバイスをしてくれます。気になることをひとこと入力すると、より具体的なアドバイスが得られます。" />
          </span>
          <input
            className="today-note-input"
            type="text"
            value={todayNote}
            onChange={e => setTodayNote(e.target.value)}
            placeholder="気になっていることや悩みをひとこと…（任意）"
            maxLength={60}
          />
          <div className="ai-advice-header">
            <span />
            <button
              className={`chip-btn primary${aiLoading ? ' loading' : ''}`}
              onClick={handleAIAdvice}
              disabled={aiLoading}
            >
              {aiLoading ? '考え中…' : aiAdvice ? 'もう一度' : '相談する'}
            </button>
          </div>
          {aiLoading && (
            <div className="ai-loading">
              <span className="ai-spinner" />
              <span>AIがアドバイスを考えています…</span>
            </div>
          )}
          {aiAdvice && !aiLoading && <p className="ai-advice-result">🤖 {aiAdvice}</p>}
          {aiError  && !aiLoading && <p className="ai-advice-error">⚠️ {aiError}</p>}
        </div>
      </div>

      {/* ③ 連続記録 / 改善度 */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon">🔥</div>
          <div className="stat-num">{streak}<span className="stat-unit">日</span></div>
          <div className="stat-label">連続記録</div>
        </div>
        <div className="stat-card">
          {improve !== null ? (
            <>
              <div className="stat-icon">{improve >= 0 ? '📈' : '📉'}</div>
              <div className="stat-num" style={{ color: improve >= 0 ? '#64B6AC' : '#E07B7B' }}>
                {improve >= 0 ? '+' : ''}{improve}<span className="stat-unit">%</span>
              </div>
              <div className="stat-label">{improve >= 0 ? '前週より好調' : '前週との比較'}</div>
            </>
          ) : (
            <>
              <div className="stat-icon">📊</div>
              <div className="stat-num" style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 500 }}>記録が増えると表示</div>
              <div className="stat-label">改善度</div>
            </>
          )}
        </div>
      </div>

      {/* ④ 手紙機能 */}
      {(['tired', 'stressed', 'burnout'].includes(state.status) && getLetters().length > 0) && (() => {
        const letters = getLetters();
        const letter  = letters[Math.floor(Math.random() * letters.length)];
        return (
          <div className="card letter-read-card">
            <div className="letter-read-title">💌 調子が良かった日の自分より</div>
            <p className="letter-read-body">「{letter.text}」</p>
            <p className="letter-read-date">
              {new Date(letter.date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })} に書きました
            </p>
          </div>
        );
      })()}

      <Collapsible title="💌 未来の自分への手紙" helpText="調子のいい日に、つらい日の自分へメッセージを書き残しておけます。落ち込んだ日に、過去の自分からの手紙が届きます。">
        {wroteLetterToday() || letterSent ? (
          <p className="letter-sent-msg">✅ 今日の手紙はもう届いています。また明日！</p>
        ) : (
          <>
            <p className="letter-write-hint">つらい日の自分へ。今の気持ちや励ましを残しておきましょう。</p>
            <textarea
              className="memo-area"
              value={letterText}
              onChange={(e) => setLetterText(e.target.value)}
              placeholder="「大丈夫だよ。あの時も乗り越えられたよね。」など…"
              rows={3}
            />
            <button
              className="chip-btn primary"
              style={{ width: '100%', marginTop: 8, padding: '12px' }}
              onClick={() => { if (letterText.trim()) { saveLetter(letterText); setLetterSent(true); } }}
              disabled={!letterText.trim()}
            >
              手紙を残す 💌
            </button>
          </>
        )}
      </Collapsible>

      {/* ⑤ 今週のふりかえり */}
      {weeklySummary && (
        <div className="card">
          <h2 className="card-section-title">📊 今週のふりかえり</h2>
          <ul className="summary-list">
            {weeklySummary.map((m, i) => (
              <li key={i} className="summary-item">
                <span className="summary-icon">{m.icon}</span>
                <span className="summary-text">{m.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ⑥ 今日のひとこと */}
      <div className="card">
        <h2 className="card-section-title">✨ 今日のひとこと</h2>
        <p className="tip-body">「{tip}」</p>
      </div>

      {/* ⑦ 深呼吸エクササイズ（折りたたみ） */}
      <Collapsible title="🫁 深呼吸エクササイズ（4-7-8）" helpText="ストレス解消に効果的な4-7-8呼吸法を練習できます。「吸う4秒 → 止める7秒 → 吐く8秒」を3回繰り返すだけで、気持ちが落ち着きます。">
        <p className="card-desc" style={{ marginBottom: 12 }}>
          ストレスを感じたら試してみましょう。吸う4秒→止める7秒→吐く8秒を3回繰り返します。
        </p>
        <div style={{ textAlign: 'right', marginBottom: breathing ? 0 : 4 }}>
          {!breathing ? (
            <button className="chip-btn primary" onClick={startBreathing}>始める</button>
          ) : (
            <button className="chip-btn danger" onClick={stopBreathing}>終了</button>
          )}
        </div>
        {breathing && (
          <div className="breathing-area">
            <div className={`breath-circle breath-${breathPhase}`}>
              <span className="breath-text">{breathLabel}</span>
            </div>
            <p className="breath-progress">{breathRound + 1} / 3 回目</p>
          </div>
        )}
      </Collapsible>

    </div>
  );
}
