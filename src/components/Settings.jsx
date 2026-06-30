import React, { useState, useEffect } from 'react';
import { getSettingsWithDefaults, saveSettings } from '../utils/storage';
import { supabase } from '../utils/supabase';
import PageHeader from './PageHeader';
import HelpTooltip from './HelpTooltip';

const GUIDE_ITEMS = [
  { icon: '✏️', title: '今日の記録（チェックイン）', desc: 'ホーム画面で気分・体調の絵文字を1タップするだけで即記録できます。メモや詳細を残したい場合は「メモや詳細も記録する」からスライダーで入力できます。' },
  { icon: '🤖', title: 'AIに相談する', desc: 'ホーム画面から、記録データをもとにAIがパーソナライズされたアドバイスをしてくれます。気になることを入力するとより具体的な回答が得られます。' },
  { icon: '🔥', title: '連続記録', desc: '毎日記録を続けた日数が表示されます。継続のモチベーションアップに活用しましょう。' },
  { icon: '📈', title: '最近の状態（可視化）', desc: '直近7日間の気分（縦軸）と体調（横軸）の相関を「絶好調・心は元気・体は動ける・要注意」の4ゾーンで表示します。ドットが右上に集まるほど好調、左下に集まるほど要注意な状態です。' },
  { icon: '💌', title: '未来の自分への手紙', desc: '調子のいい日に、つらい日の自分へメッセージを書き残せます。落ち込んだ日に過去の自分からの手紙が届きます。' },
  { icon: '🫁', title: '深呼吸エクササイズ', desc: 'ストレス解消に効果的な4-7-8呼吸法（吸う4秒→止める7秒→吐く8秒）を3回練習できます。' },
  { icon: '📊', title: '履歴・グラフ', desc: '過去の気分・体調の変化をグラフ、カレンダー、記録一覧の3つの形式で振り返れます。' },
  { icon: '🔔', title: 'リマインダー通知', desc: '指定した時刻に「記録を促す通知」を受け取れます。ブラウザの通知を許可する必要があります。' },
];

function UsageGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="card">
      <button className="guide-toggle" onClick={() => setOpen(o => !o)}>
        <span>📖 使い方の説明</span>
        <span className={`guide-chevron${open ? ' open' : ''}`}>›</span>
      </button>
      {open && (
        <div className="guide-list">
          {GUIDE_ITEMS.map((item) => (
            <div key={item.title} className="guide-item">
              <span className="guide-icon">{item.icon}</span>
              <div>
                <div className="guide-item-title">{item.title}</div>
                <div className="guide-item-desc">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Settings({ user }) {
  const [s, setS]       = useState({ name: '', notificationTime: '21:00', notificationEnabled: false });
  const [saved, setSaved] = useState(false);
  const [perm, setPerm]   = useState('default');

  useEffect(() => {
    setS(getSettingsWithDefaults());
    if ('Notification' in window) setPerm(Notification.permission);
  }, []);

  const set = (key, val) => setS((prev) => ({ ...prev, [key]: val }));

  const handleSave = () => {
    saveSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const requestNotif = async () => {
    if (!('Notification' in window)) {
      alert('このブラウザは通知に対応していません');
      return;
    }
    const result = await Notification.requestPermission();
    setPerm(result);
    if (result === 'granted') {
      set('notificationEnabled', true);
      new Notification('こころの記録 🌱', {
        body: '通知が設定されました！毎日の記録を続けましょう。',
      });
    }
  };

  return (
    <div className="screen settings-screen">
      <PageHeader title="設定" subtitle="アプリのカスタマイズ" emoji="⚙️" />

      {user && (
        <div className="card user-card">
          <div className="user-row">
            {user.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="avatar" className="user-avatar" />
            ) : (
              <div className="user-avatar-fallback">
                {(user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()}
              </div>
            )}
            <div className="user-info">
              <div className="user-name">{user.user_metadata?.full_name || user.user_metadata?.name || 'ユーザー'}</div>
              <div className="user-email">{user.email}</div>
            </div>
          </div>
          <button
            className="logout-btn"
            onClick={async () => {
              if (window.confirm('ログアウトしますか？')) await supabase.auth.signOut();
            }}
          >
            ログアウト
          </button>
        </div>
      )}

      <div className="card">
        <h2 className="card-section-title">プロフィール</h2>
        <label className="form-label">お名前（任意）</label>
        <input
          type="text"
          className="form-input"
          value={s.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="ニックネームでもOK"
          maxLength={20}
        />
      </div>

      <UsageGuide />

      <div className="card">
        <h2 className="card-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          🔔 リマインダー
          <HelpTooltip text="指定した時刻に記録を促す通知を受け取れます。アプリを開いているときだけ通知されます。まず「通知を許可する」を押してください。" />
        </h2>
        <label className="form-label">通知時刻</label>
        <input
          type="time"
          className="form-input"
          value={s.notificationTime}
          onChange={(e) => set('notificationTime', e.target.value)}
        />
        <div className="notif-block">
          {perm === 'granted' ? (
            <div className="notif-ok">
              <span>✅</span>
              <span>通知が有効です（アプリを開いているとき {s.notificationTime} に通知します）</span>
            </div>
          ) : perm === 'denied' ? (
            <div className="notif-denied">
              <span>🔕</span>
              <span>通知がブロックされています。ブラウザの設定から許可してください。</span>
            </div>
          ) : (
            <button className="notif-request-btn" onClick={requestNotif}>
              🔔 通知を許可する
            </button>
          )}
        </div>
      </div>

      <div className="card privacy-card">
        <h2 className="card-section-title">🔒 プライバシー</h2>
        <p className="privacy-text">
          記録データはSupabaseデータベースに安全に保存されます。<br />
          AI相談機能を使用する場合のみ、状態データがサーバーに送信されます。
        </p>
      </div>

      <div className="card">
        <h2 className="card-section-title">データ管理</h2>
        <button
          className="danger-btn"
          onClick={() => {
            if (window.confirm('すべての記録を削除します。この操作は元に戻せません。')) {
              localStorage.removeItem('kokoro_entries');
              alert('記録を削除しました。');
            }
          }}
        >
          🗑 記録をすべて削除する
        </button>
      </div>

      <button className={`save-btn ${saved ? 'saved' : ''}`} onClick={handleSave}>
        {saved ? '✓ 保存しました！' : '設定を保存する'}
      </button>
    </div>
  );
}
