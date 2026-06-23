import React, { useState, useEffect } from 'react';
import { getEntries } from '../utils/storage';
import { getLetters, updateLetter, deleteLetter } from '../utils/storage';
import { getLast7Days, MOOD_OPTIONS, ENERGY_OPTIONS, calculateImprovement } from '../utils/analysis';
import PageHeader from './PageHeader';
import HelpTooltip from './HelpTooltip';

/* ---------- Bar Chart (7日間) ---------- */
function BarChart({ days, metric }) {
  const baseColor  = metric === 'mood' ? '#7C6FCD' : '#64B6AC';
  const todayColor = metric === 'mood' ? '#A89FDE' : '#95E1D3';
  const W = 320, H = 140, padL = 16, padR = 16, padT = 8, padB = 36;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const slot = cW / 7;
  const bW   = slot * 0.55;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="bar-chart">
      {[1,2,3,4,5].map(v => {
        const y = padT + cH - (v / 5) * cH;
        return <line key={v} x1={padL} x2={W - padR} y1={y} y2={y} stroke="#F0F4F8" strokeWidth="1" />;
      })}
      {days.map((day, i) => {
        const cx  = padL + (i + 0.5) * slot;
        const val = day.entry ? day.entry[metric] : 0;
        const bH  = (val / 5) * cH || 3;
        const by  = padT + cH - bH;
        const fill = day.entry ? (day.isToday ? todayColor : baseColor) : '#E5E7EB';
        return (
          <g key={i}>
            <rect x={cx - bW / 2} y={by} width={bW} height={bH} rx={5} fill={fill} opacity={day.entry ? 0.9 : 0.4} />
            <text x={cx} y={H - 18} textAnchor="middle" fontSize="11"
              fill={day.isToday ? baseColor : '#9CA3AF'} fontWeight={day.isToday ? '800' : '400'}>
              {day.label}
            </text>
            {day.isToday && <circle cx={cx} cy={H - 6} r={3} fill={baseColor} />}
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Line Chart (全期間) ---------- */
function LineChart({ entries, metric }) {
  if (entries.length === 0) return <p className="empty-hint">記録が増えるとグラフが表示されます</p>;

  const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
  const H = 150, padT = 12, padB = 38, padL = 8, padR = 8;
  const cH   = H - padT - padB;
  const ptW  = Math.max(32, Math.min(52, 560 / sorted.length));
  const W    = Math.max(320, sorted.length * ptW + padL + padR);
  const color = metric === 'mood' ? '#7C6FCD' : '#64B6AC';

  const xOf = (i) => padL + i * ptW + ptW / 2;
  const yOf = (v) => padT + cH - ((v - 1) / 4) * cH;

  const today = new Date().toDateString();
  const pathD = sorted.map((e, i) => `${i === 0 ? 'M' : 'L'}${xOf(i)},${yOf(e[metric])}`).join(' ');
  const areaD = pathD +
    ` L${xOf(sorted.length - 1)},${padT + cH} L${xOf(0)},${padT + cH} Z`;

  const showLabel = (i) =>
    sorted.length <= 14 ||
    i === 0 ||
    i === sorted.length - 1 ||
    i % Math.ceil(sorted.length / 8) === 0;

  return (
    <div className="line-chart-scroll">
      <svg width={W} height={H} style={{ display: 'block' }}>
        {[1,2,3,4,5].map(v => (
          <line key={v} x1={padL} x2={W - padR} y1={yOf(v)} y2={yOf(v)} stroke="#F0F4F8" strokeWidth="1" />
        ))}
        <path d={areaD} fill={color} opacity="0.08" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
        {sorted.map((e, i) => {
          const isToday = new Date(e.date + 'T00:00:00').toDateString() === today;
          return (
            <g key={i}>
              <circle cx={xOf(i)} cy={yOf(e[metric])} r={isToday ? 6 : 3.5}
                fill={color} opacity={isToday ? 1 : 0.75} />
              {isToday && (
                <circle cx={xOf(i)} cy={yOf(e[metric])} r={10}
                  fill="none" stroke={color} strokeWidth="1.5" opacity="0.35" />
              )}
            </g>
          );
        })}
        {sorted.map((e, i) => {
          if (!showLabel(i)) return null;
          const d = new Date(e.date + 'T00:00:00');
          const isToday = d.toDateString() === today;
          return (
            <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle" fontSize="10"
              fill={isToday ? color : '#9CA3AF'} fontWeight={isToday ? '800' : '400'}>
              {d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/* ---------- Calendar View ---------- */
function CalendarView({ entries }) {
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selected, setSelected] = useState(null);

  const year = month.getFullYear();
  const mon  = month.getMonth();

  const entryMap = {};
  entries.forEach(e => {
    const d = new Date(e.date + 'T00:00:00');
    entryMap[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`] = e;
  });

  const startDow   = new Date(year, mon, 1).getDay();
  const daysInMon  = new Date(year, mon + 1, 0).getDate();
  const cells = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMon }, (_, i) => new Date(year, mon, i + 1)),
  ];
  const moodColor = (m) => ['','#E07B7B','#F5A623','#F5D76E','#7ECBA1','#64B6AC'][m] || null;
  const today = new Date();

  const changeMonth = (dir) => { setSelected(null); setMonth(m => new Date(m.getFullYear(), m.getMonth() + dir, 1)); };

  return (
    <div className="calendar-view">
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={() => changeMonth(-1)}>‹</button>
        <span className="cal-nav-title">{year}年{mon + 1}月</span>
        <button className="cal-nav-btn" onClick={() => changeMonth(1)}>›</button>
      </div>
      <div className="cal-grid">
        {['日','月','火','水','木','金','土'].map(d => (
          <div key={d} className="cal-dow">{d}</div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} className="cal-cell cal-empty" />;
          const key   = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          const entry = entryMap[key];
          const isToday = date.toDateString() === today.toDateString();
          const isSel   = selected && date.toDateString() === selected.date.toDateString();
          const color   = entry ? moodColor(entry.mood) : null;
          return (
            <div key={key}
              className={`cal-cell${isToday ? ' cal-today' : ''}${isSel ? ' cal-selected' : ''}${entry ? ' cal-has' : ''}`}
              style={color ? { background: color + '40', borderColor: color } : {}}
              onClick={() => entry && setSelected(isSel ? null : { date, entry })}>
              <span className="cal-day-num">{date.getDate()}</span>
              {entry && <span className="cal-mood-emoji">{MOOD_OPTIONS[Math.round(entry.mood) - 1]?.emoji}</span>}
            </div>
          );
        })}
      </div>
      {selected && (
        <div className="cal-detail">
          <div className="cal-detail-date">
            {selected.date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
          </div>
          <div className="cal-detail-scores">
            <span>気分　{MOOD_OPTIONS[Math.round(selected.entry.mood) - 1]?.emoji} {MOOD_OPTIONS[Math.round(selected.entry.mood) - 1]?.label}</span>
            <span>体調　{ENERGY_OPTIONS[Math.round(selected.entry.energy) - 1]?.emoji} {ENERGY_OPTIONS[Math.round(selected.entry.energy) - 1]?.label}</span>
          </div>
          {selected.entry.memo && <p className="cal-detail-memo">「{selected.entry.memo}」</p>}
        </div>
      )}
      <div className="cal-legend">
        {MOOD_OPTIONS.map(o => (
          <span key={o.value} className="cal-legend-item">
            <span className="cal-legend-dot" style={{ background: o.color + '60', borderColor: o.color }} />
            {o.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Records List ---------- */
function RecordsList({ entries }) {
  const [letters, setLetters]   = useState(() => getLetters());
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText]   = useState('');
  const [tab, setTab]             = useState('memos');

  const memos = [...entries]
    .filter(e => e.memo)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const sorted = [...letters].sort((a, b) => new Date(b.date) - new Date(a.date));

  const handleEdit = (l) => { setEditingId(l.id); setEditText(l.text); };
  const handleSave = (id) => {
    if (!editText.trim()) return;
    updateLetter(id, editText);
    setLetters(getLetters());
    setEditingId(null);
  };
  const handleDelete = (id) => {
    if (!window.confirm('この手紙を削除しますか？')) return;
    deleteLetter(id);
    setLetters(getLetters());
  };

  return (
    <div className="records-view">
      <div className="tab-row" style={{ marginBottom: 14 }}>
        <button className={`tab-btn ${tab === 'memos' ? 'active' : ''}`} onClick={() => setTab('memos')}>
          📝 メモ一覧
        </button>
        <button className={`tab-btn ${tab === 'letters' ? 'active' : ''}`} onClick={() => setTab('letters')}>
          💌 手紙一覧
        </button>
      </div>

      {tab === 'memos' && (
        memos.length === 0 ? (
          <p className="empty-hint">メモ付きの記録がまだありません</p>
        ) : (
          <div className="record-list">
            {memos.map(e => {
              const d = new Date(e.date + 'T00:00:00');
              return (
                <div key={e.id} className="record-item">
                  <div className="record-item-header">
                    <span className="record-date">
                      {d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                    </span>
                    <span className="record-emojis">
                      {MOOD_OPTIONS[Math.round(e.mood) - 1]?.emoji}{ENERGY_OPTIONS[Math.round(e.energy) - 1]?.emoji}
                    </span>
                  </div>
                  <p className="record-memo">「{e.memo}」</p>
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === 'letters' && (
        sorted.length === 0 ? (
          <p className="empty-hint">まだ手紙がありません。調子が良い日に書いてみましょう。</p>
        ) : (
          <div className="record-list">
            {sorted.map(l => (
              <div key={l.id} className="record-item letter-item">
                <div className="record-item-header">
                  <span className="record-date">
                    {new Date(l.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  <div className="letter-actions">
                    <button className="letter-action-btn edit" onClick={() => handleEdit(l)}>編集</button>
                    <button className="letter-action-btn delete" onClick={() => handleDelete(l.id)}>削除</button>
                  </div>
                </div>
                {editingId === l.id ? (
                  <div className="letter-edit-area">
                    <textarea
                      className="memo-area"
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      rows={3}
                    />
                    <div className="letter-edit-btns">
                      <button className="chip-btn" onClick={() => setEditingId(null)}>キャンセル</button>
                      <button className="chip-btn primary" onClick={() => handleSave(l.id)} disabled={!editText.trim()}>保存</button>
                    </div>
                  </div>
                ) : (
                  <p className="record-memo letter-text">「{l.text}」</p>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

/* ---------- History Screen ---------- */
export default function History() {
  const [entries, setEntries] = useState([]);
  const [view, setView]       = useState('chart');
  const [metric, setMetric]   = useState('mood');
  const [period, setPeriod]   = useState('week');

  useEffect(() => { getEntries().then(setEntries); }, []);

  const days    = getLast7Days(entries);
  const improve = calculateImprovement(entries);

  return (
    <div className="screen history-screen">
      <PageHeader title="履歴" subtitle="記録の振り返り" emoji="📊" />

      <div className="card" style={{ marginTop: 20 }}>
        <div className="tab-row" style={{ alignItems: 'center' }}>
          <button className={`tab-btn ${view === 'chart'    ? 'active' : ''}`} onClick={() => setView('chart')}>📈 グラフ</button>
          <button className={`tab-btn ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')}>📅 カレンダー</button>
          <button className={`tab-btn ${view === 'records'  ? 'active' : ''}`} onClick={() => setView('records')}>📝 記録</button>
          <HelpTooltip text="グラフ：気分・体調の推移を折れ線・棒グラフで確認。カレンダー：日ごとの記録を月ビューで表示。記録：メモと手紙の一覧。" align="right" />
        </div>

        {view === 'chart' && (
          <>
            <div className="tab-row" style={{ marginTop: 8 }}>
              <button className={`tab-btn ${period === 'week' ? 'active' : ''}`} onClick={() => setPeriod('week')}>7日間</button>
              <button className={`tab-btn ${period === 'all'  ? 'active' : ''}`} onClick={() => setPeriod('all')}>全期間</button>
            </div>
            <div className="tab-row" style={{ marginTop: 8 }}>
              {['mood','energy'].map(m => (
                <button key={m} className={`tab-btn ${metric === m ? 'active' : ''}`} onClick={() => setMetric(m)}>
                  {m === 'mood' ? '😊 気分' : '⚡ 体調'}
                </button>
              ))}
            </div>
            {period === 'week'
              ? <BarChart days={days} metric={metric} />
              : <LineChart entries={entries} metric={metric} />
            }
            {period === 'week' && improve !== null && (
              <p className="chart-note" style={{ color: improve >= 0 ? '#64B6AC' : '#E07B7B' }}>
                {improve >= 0 ? `📈 前週比 +${improve}% 好調です！` : `📉 前週比 ${improve}%（先週より少し低め）`}
              </p>
            )}
            {period === 'all' && entries.length > 0 && (
              <p className="chart-note" style={{ color: '#9CA3AF' }}>
                全{entries.length}日分の記録 · 左右にスクロールできます
              </p>
            )}
          </>
        )}

        {view === 'calendar' && <CalendarView entries={entries} />}
        {view === 'records'  && <RecordsList entries={entries} />}
      </div>

      {view === 'chart' && period === 'week' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 className="card-section-title">日別の記録</h2>
          <div className="day-list">
            {[...days].reverse().map((day, i) => (
              day.entry ? (
                <div key={i} className="day-row">
                  <div className="day-date">
                    <span className="day-label" style={day.isToday ? { color: 'var(--primary)', fontWeight: 800 } : {}}>
                      {day.isToday ? '今日' : day.label}
                    </span>
                    <span className="day-mmdd">
                      {day.date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="day-content">
                    <span className="day-score-emoji">
                      {MOOD_OPTIONS[Math.round(day.entry.mood) - 1]?.emoji}
                      {ENERGY_OPTIONS[Math.round(day.entry.energy) - 1]?.emoji}
                    </span>
                    {day.entry.memo && <p className="day-memo">"{day.entry.memo}"</p>}
                  </div>
                </div>
              ) : (
                <div key={i} className="day-row day-row-empty">
                  <div className="day-date">
                    <span className="day-label">{day.label}</span>
                    <span className="day-mmdd">
                      {day.date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="day-empty-content">
                    <span className="day-empty-icon">＋</span>
                    <span className="day-empty-text">この日はお休み</span>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
