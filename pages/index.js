import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getEmbedding, cosineSimilarity, getBalanceScore,
  getArchetype, getTrends, generateShoutout,
} from '../lib/ml';
import {
  onAuth, signIn, createUser, getUser, updateUserLog, commitWeek,
  createCircle, joinCircle, onCircleMembers,
  postToFeed, onFeed, toggleReaction, addReply,
} from '../lib/store';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const REACTIONS = ['🔥', '💀', '👑', '😭', '💪'];
const EMBED_LABELS = ['Sugar', 'Ate Out', 'Junk', 'Workouts', 'Sleep'];

// ─── UTILS ───────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return 'just now';
  const ms = ts?.toMillis ? ts.toMillis() : ts;
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── BASE COMPONENTS ──────────────────────────────────────────────────────────
function Avatar({ initials = '?', size = 36, bg = '#c8f04a', color = '#000' }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Syne', fontWeight: 800, fontSize: size * 0.38,
      color, flexShrink: 0, letterSpacing: -0.5,
    }}>{initials}</div>
  );
}

function Counter({ label, emoji, value, onChange, max = 7, unit = '/ 7 days' }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{emoji}</span>
        <span style={{ fontFamily: 'Syne', fontWeight: 600 }}>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--border)' }}>{unit}</span>
      </p>
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--surface2)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <button onClick={() => onChange(Math.max(0, value - 1))} style={{
          width: 50, height: 50, border: 'none', background: 'transparent',
          color: 'var(--muted)', fontSize: 22, cursor: 'pointer',
        }}>−</button>
        <span style={{ flex: 1, textAlign: 'center', fontFamily: 'Syne', fontWeight: 800, fontSize: 24 }}>
          {value}
        </span>
        <button onClick={() => onChange(Math.min(max, value + 1))} style={{
          width: 50, height: 50, border: 'none',
          background: value >= max ? 'var(--surface2)' : 'var(--accent)',
          color: value >= max ? 'var(--muted)' : '#000',
          fontSize: 22, cursor: 'pointer', transition: 'all 0.15s',
        }}>+</button>
      </div>
    </div>
  );
}

function TabBar({ tab, setTab }) {
  const tabs = [
    { id: 'hub', label: 'My Hub', emoji: '⌂' },
    { id: 'circle', label: 'Circle', emoji: '◎' },
    { id: 'wrapped', label: 'Wrapped', emoji: '✦' },
  ];
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 430,
      background: 'rgba(6,6,6,0.97)', backdropFilter: 'blur(20px)',
      borderTop: '1px solid var(--border)',
      display: 'flex', justifyContent: 'space-around',
      padding: '10px 0 22px', zIndex: 100,
    }}>
      {tabs.map(({ id, label, emoji }) => {
        const active = tab === id;
        return (
          <button key={id} onClick={() => setTab(id)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer',
            color: active ? 'var(--accent)' : 'var(--muted)',
            fontFamily: 'Syne', fontSize: 11, fontWeight: active ? 700 : 400,
            padding: '4px 24px', transition: 'color 0.15s',
          }}>
            <span style={{ fontSize: 20 }}>{emoji}</span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function Onboarding({ uid, onDone }) {
  const [step, setStep] = useState('name'); // name → circle
  const [name, setName] = useState('');
  const [circleAction, setCircleAction] = useState('join'); // join | create
  const [circleCode, setCircleCode] = useState('');
  const [circleName, setCircleName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submitName = async () => {
    if (!name.trim()) return;
    if (!uid) {
      setError('Authentication problem, please refresh the page');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await createUser(uid, name.trim());
      setStep('circle');
    } catch (e) {
      console.error('createUser failed', e);
      setError(e.message || 'Could not create user');
    } finally {
      setLoading(false);
    }
  };

  const submitCircle = async () => {
    setLoading(true);
    setError('');
    try {
      if (circleAction === 'create') {
        if (!circleName.trim()) { setError('Enter a circle name'); setLoading(false); return; }
        const code = await createCircle(uid, circleName.trim());
        onDone({ code });
      } else {
        if (!circleCode.trim()) { setError('Enter a circle code'); setLoading(false); return; }
        await joinCircle(uid, circleCode.trim());
        onDone({});
      }
    } catch (e) {
      setError(e.message || 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '32px 24px',
      background: 'radial-gradient(ellipse at 50% 0%, #152500 0%, var(--bg) 65%)',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🎧</div>
        <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 34, lineHeight: 1.1 }}>
          Habit<span style={{ color: 'var(--accent)' }}>Wrapped</span>
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>
          Spotify Wrapped for your lifestyle
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: 340 }}>
        {step === 'name' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontFamily: 'Syne', fontWeight: 600, fontSize: 13, color: 'var(--muted)' }}>
              What should we call you?
            </label>
            <input
              autoFocus value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitName()}
              placeholder="Your first name"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            {error && <p style={{ fontSize: 13, color: 'var(--red)', textAlign: 'center' }}>{error}</p>}
            <button onClick={submitName} disabled={!name.trim() || loading} style={btnStyle(name.trim() && !loading)}>
              {loading ? 'Setting up...' : 'Continue →'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {['join', 'create'].map(a => (
                <button key={a} onClick={() => { setCircleAction(a); setError(''); }} style={{
                  flex: 1, padding: '10px', border: `1px solid ${circleAction === a ? 'var(--accent)' : 'var(--border)'}`,
                  background: circleAction === a ? 'var(--accent-dim)' : 'var(--surface)',
                  color: circleAction === a ? 'var(--accent)' : 'var(--muted)',
                  borderRadius: 10, fontFamily: 'Syne', fontWeight: 700,
                  fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', textTransform: 'capitalize',
                }}>{a} a Circle</button>
              ))}
            </div>

            {circleAction === 'join' ? (
              <>
                <label style={{ fontFamily: 'Syne', fontWeight: 600, fontSize: 13, color: 'var(--muted)' }}>
                  Enter your circle code
                </label>
                <input
                  autoFocus value={circleCode}
                  onChange={e => setCircleCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && submitCircle()}
                  placeholder="ABC123"
                  style={{ ...inputStyle, letterSpacing: 4, fontFamily: 'Syne', fontWeight: 700, fontSize: 18 }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </>
            ) : (
              <>
                <label style={{ fontFamily: 'Syne', fontWeight: 600, fontSize: 13, color: 'var(--muted)' }}>
                  Name your circle
                </label>
                <input
                  autoFocus value={circleName}
                  onChange={e => setCircleName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitCircle()}
                  placeholder="e.g. Berkeley House 🏠"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </>
            )}

            {error && <p style={{ fontSize: 13, color: 'var(--red)', textAlign: 'center' }}>{error}</p>}

            <button onClick={submitCircle} disabled={loading} style={btnStyle(!loading)}>
              {loading ? (circleAction === 'join' ? 'Joining...' : 'Creating...') :
                (circleAction === 'join' ? 'Join Circle →' : 'Create Circle →')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '14px 16px',
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 12, color: 'var(--text)', fontSize: 16,
  fontFamily: 'DM Sans', outline: 'none', transition: 'border-color 0.2s',
};
const btnStyle = (active) => ({
  padding: '14px', background: active ? 'var(--accent)' : 'var(--surface)',
  color: active ? '#000' : 'var(--muted)', border: 'none', borderRadius: 12,
  fontFamily: 'Syne', fontWeight: 800, fontSize: 15,
  cursor: active ? 'pointer' : 'default', transition: 'all 0.2s',
});

// ─── CIRCLE CODE MODAL ────────────────────────────────────────────────────────
function CircleCodeModal({ code, circleName, onClose }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 24,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 24, padding: 32, width: '100%', maxWidth: 340,
        display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center',
      }}>
        <div style={{ fontSize: 40 }}>🎉</div>
        <h2 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 20 }}>Circle Created!</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Share this code with your friends to join <strong style={{ color: 'var(--text)' }}>{circleName}</strong></p>
        <div style={{
          background: 'var(--surface2)', border: '1px solid var(--accent)44',
          borderRadius: 16, padding: '20px',
        }}>
          <p style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 36, color: 'var(--accent)', letterSpacing: 6 }}>{code}</p>
        </div>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{ ...btnStyle(true), padding: '12px' }}>
          {copied ? '✓ Copied!' : 'Copy Code'}
        </button>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}>
          Start Logging →
        </button>
      </div>
    </div>
  );
}

// ─── EMBEDDING COMPARISON ──────────────────────────────────────────────────────
function EmbeddingComparison({ myEmbed, friend }) {
  const friendEmbed = friend.embedding || getEmbedding(friend.currentLog || {});
  const similarity = Math.round(cosineSimilarity(myEmbed, friendEmbed) * 100);

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar initials={friend.initials} size={36} bg="var(--surface2)" color="var(--text)" />
          <div>
            <p style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14 }}>{friend.name}</p>
            <p style={{ fontSize: 11, color: 'var(--muted)' }}>{friend.archetype || 'The Work in Progress'}</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 24, color: similarity >= 75 ? 'var(--accent)' : similarity >= 50 ? 'var(--text)' : 'var(--muted)' }}>
            {similarity}%
          </p>
          <p style={{ fontSize: 10, color: 'var(--muted)' }}>match</p>
        </div>
      </div>

      {/* Dimension bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {EMBED_LABELS.map((label, i) => {
          const myVal = myEmbed[i];
          const theirVal = friendEmbed[i];
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--muted)', width: 48, flexShrink: 0 }}>{label}</span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* My bar */}
                <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${myVal * 100}%`,
                    background: 'var(--accent)', borderRadius: 3, transition: 'width 0.6s ease',
                  }} />
                </div>
                {/* Their bar */}
                <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${theirVal * 100}%`,
                    background: '#60a5fa', borderRadius: 3, transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--muted)' }}>
          <div style={{ width: 16, height: 4, background: 'var(--accent)', borderRadius: 2 }} />
          You
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--muted)' }}>
          <div style={{ width: 16, height: 4, background: '#60a5fa', borderRadius: 2 }} />
          {friend.name}
        </div>
      </div>
    </div>
  );
}

// ─── HUB TAB ─────────────────────────────────────────────────────────────────
function HubTab({ userData, log, setLog, onLog, saving }) {
  const score = getBalanceScore(log);
  const archetype = getArchetype(log);
  const trends = getTrends(log, userData.history || []);
  const [posted, setPosted] = useState(false);

  const handlePost = async () => {
    await onLog();
    setPosted(true);
    setTimeout(() => setPosted(false), 3000);
  };

  return (
    <div style={{ padding: '24px 16px 100px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <p style={{ fontSize: 11, letterSpacing: 2, color: 'var(--muted)', fontFamily: 'Syne' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}
        </p>
        <h1 style={{ fontSize: 30, fontFamily: 'Syne', fontWeight: 800 }}>Hey, {userData.name} 👋</h1>
      </div>

      {/* Score card */}
      <div style={{
        background: 'linear-gradient(135deg, #0c1f00 0%, #162e00 100%)',
        border: '1px solid rgba(200,240,74,0.2)', borderRadius: 20, padding: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <p style={{ fontSize: 10, fontFamily: 'Syne', fontWeight: 700, color: 'var(--accent)', letterSpacing: 2 }}>BALANCE SCORE</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 64, fontFamily: 'Syne', fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{score}</span>
            <span style={{ color: 'var(--muted)', fontSize: 14 }}>/100</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            {score >= 70 ? "You're crushing it 🔥" : score >= 50 ? "Solid week" : "Room to grow"}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 38 }}>{archetype.emoji}</div>
          <p style={{ fontSize: 10, fontFamily: 'Syne', fontWeight: 700, color: archetype.color, maxWidth: 100, textAlign: 'right', marginTop: 6, lineHeight: 1.4 }}>
            {archetype.label}
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          { val: log.workouts, label: 'Workouts', good: true },
          { val: log.ateOut, label: 'Ate Out', good: false },
          { val: log.sleep + 'h', label: 'Sleep', good: true },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '14px 12px',
          }}>
            <p style={{
              fontFamily: 'Syne', fontWeight: 800, fontSize: 26,
              color: s.good ? 'var(--accent)' : (typeof s.val === 'number' && s.val > 3) ? 'var(--red)' : 'var(--text)',
            }}>{s.val}</p>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Trends */}
      {trends.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {trends.map((t, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: t.good ? 'rgba(200,240,74,0.07)' : 'rgba(255,79,79,0.07)',
              border: `1px solid ${t.good ? 'rgba(200,240,74,0.18)' : 'rgba(255,79,79,0.18)'}`,
              borderRadius: 10, padding: '8px 12px', fontSize: 13,
            }}>
              <span style={{ color: t.good ? 'var(--accent)' : 'var(--red)' }}>{t.good ? '↑' : '↓'} {t.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Log form */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 17 }}>Log This Week</h2>
          {(userData.history || []).length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface2)', padding: '3px 8px', borderRadius: 6 }}>
              Week {(userData.history || []).length + 1}
            </span>
          )}
        </div>

        <Counter label="Sugar meals" emoji="🍬" value={log.sugar}
          onChange={v => setLog(l => ({ ...l, sugar: v }))} />
        <Counter label="Ate out" emoji="🍔" value={log.ateOut}
          onChange={v => setLog(l => ({ ...l, ateOut: v }))} />
        <Counter label="Junk food" emoji="🌮" value={log.junk}
          onChange={v => setLog(l => ({ ...l, junk: v }))} />
        <Counter label="Workouts" emoji="💪" value={log.workouts}
          onChange={v => setLog(l => ({ ...l, workouts: v }))} max={7} />
        <Counter label="Sleep avg" emoji="😴" value={log.sleep}
          onChange={v => setLog(l => ({ ...l, sleep: v }))} max={12} unit="hrs" />

        <button onClick={handlePost} disabled={saving} style={{
          padding: '14px', marginTop: 4,
          background: posted ? 'transparent' : saving ? 'var(--surface2)' : 'var(--accent)',
          color: posted ? 'var(--accent)' : saving ? 'var(--muted)' : '#000',
          border: posted ? '1px solid var(--accent)' : 'none',
          borderRadius: 12, fontFamily: 'Syne', fontWeight: 800, fontSize: 15,
          cursor: saving ? 'default' : 'pointer', transition: 'all 0.3s',
        }}>
          {posted ? '✓ Posted to Circle!' : saving ? 'Saving...' : 'Post to Circle →'}
        </button>
      </div>

      {/* History */}
      {(userData.history || []).length > 0 && (
        <div>
          <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Past Weeks</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...userData.history].reverse().slice(0, 4).map((h, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '12px 16px',
              }}>
                <div>
                  <p style={{ fontSize: 13, fontFamily: 'Syne', fontWeight: 600 }}>{h.week}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {h.workouts} workouts · {h.ateOut}x out · {h.sleep}h sleep
                  </p>
                </div>
                <span style={{
                  fontFamily: 'Syne', fontWeight: 800, fontSize: 22,
                  color: (h.balanceScore || 0) >= 60 ? 'var(--accent)' : 'var(--muted)',
                }}>{h.balanceScore || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CIRCLE TAB ──────────────────────────────────────────────────────────────
function CircleTab({ userData, members, feed, circleName, circleCode }) {
  const [replyInputs, setReplyInputs] = useState({});
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [showEmbeddings, setShowEmbeddings] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const myEmbed = userData.embedding || getEmbedding(userData.currentLog || {});

  const otherMembers = members.filter(m => m.uid !== userData.uid);
  const allRanked = members
    .map(m => ({ ...m, score: m.balanceScore || 0 }))
    .sort((a, b) => b.score - a.score);

  const withSimilarity = otherMembers
    .map(m => ({
      ...m,
      similarity: Math.round(cosineSimilarity(myEmbed, m.embedding || getEmbedding(m.currentLog || {})) * 100),
    }))
    .sort((a, b) => b.similarity - a.similarity);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{ padding: '24px 16px 100px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: 2, color: 'var(--muted)', fontFamily: 'Syne' }}>YOUR CIRCLE</p>
          <h1 style={{ fontSize: 28, fontFamily: 'Syne', fontWeight: 800 }}>{circleName}</h1>
        </div>
        <button onClick={() => { navigator.clipboard.writeText(circleCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }}
          style={{
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '8px 12px', cursor: 'pointer',
            fontFamily: 'Syne', fontWeight: 700, fontSize: 12,
            color: codeCopied ? 'var(--accent)' : 'var(--muted)',
          }}>
          {codeCopied ? '✓ Copied' : `# ${circleCode}`}
        </button>
      </div>

      {/* Leaderboard */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden' }}>
        <div onClick={() => setShowLeaderboard(!showLeaderboard)} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', cursor: 'pointer',
        }}>
          <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16 }}>🏆 Leaderboard</h2>
          <span style={{ color: 'var(--accent)', fontSize: 13 }}>{showLeaderboard ? '▲' : '▼'}</span>
        </div>
        {showLeaderboard && (
          <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {allRanked.map((u, i) => (
              <div key={u.uid} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                background: u.uid === userData.uid ? 'rgba(200,240,74,0.06)' : 'var(--surface2)',
                border: `1px solid ${u.uid === userData.uid ? 'rgba(200,240,74,0.25)' : 'var(--border)'}`,
                borderRadius: 12,
              }}>
                <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{medals[i] || `${i + 1}`}</span>
                <Avatar initials={u.initials} size={32} bg={i === 0 ? 'var(--accent)' : 'var(--surface)'} color={i === 0 ? '#000' : 'var(--text)'} />
                <span style={{ flex: 1, fontFamily: 'Syne', fontWeight: 600, fontSize: 14 }}>
                  {u.name} {u.uid === userData.uid && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(you)</span>}
                </span>
                <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: i === 0 ? 'var(--accent)' : 'var(--text)' }}>
                  {u.score}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lifestyle Embeddings — the ML section */}
      {otherMembers.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden' }}>
          <div onClick={() => setShowEmbeddings(!showEmbeddings)} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 20px', cursor: 'pointer',
          }}>
            <div>
              <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16 }}>🧬 Lifestyle Compatibility</h2>
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Cosine similarity of 5D habit embeddings</p>
            </div>
            <span style={{ color: 'var(--accent)', fontSize: 13 }}>{showEmbeddings ? '▲' : '▼'}</span>
          </div>

          {showEmbeddings && (
            <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Quick summary */}
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {withSimilarity.map(f => (
                  <button key={f.uid} onClick={() => setSelectedFriend(selectedFriend?.uid === f.uid ? null : f)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      background: selectedFriend?.uid === f.uid ? 'rgba(200,240,74,0.1)' : 'var(--surface2)',
                      border: `1px solid ${selectedFriend?.uid === f.uid ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 14, padding: '12px 16px', cursor: 'pointer', flexShrink: 0,
                      transition: 'all 0.15s',
                    }}>
                    <Avatar initials={f.initials} size={32} bg="var(--surface)" color="var(--text)" />
                    <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 11 }}>{f.name}</span>
                    <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: f.similarity >= 75 ? 'var(--accent)' : 'var(--text)' }}>
                      {f.similarity}%
                    </span>
                  </button>
                ))}
              </div>

              {/* Detailed comparison */}
              {selectedFriend && (
                <EmbeddingComparison myEmbed={myEmbed} friend={selectedFriend} />
              )}

              {!selectedFriend && (
                <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '8px 0' }}>
                  Tap a friend to see dimension-by-dimension breakdown
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16 }}>Circle Feed</h2>
        {feed.length === 0 && (
          <div style={{
            textAlign: 'center', padding: 32, color: 'var(--muted)', fontSize: 14,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
          }}>
            No posts yet. Log your week on the Hub tab to kick things off. 👆
          </div>
        )}
        {feed.map(post => (
          <div key={post.id} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Avatar
                initials={post.initials}
                size={36}
                bg={post.uid === userData.uid ? 'var(--accent)' : 'var(--surface2)'}
                color={post.uid === userData.uid ? '#000' : 'var(--text)'}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13 }}>{post.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{timeAgo(post.ts)}</span>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.55, marginTop: 4 }}>{post.message}</p>
              </div>
            </div>

            {/* Reactions */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 46 }}>
              {REACTIONS.map(emoji => {
                const users = post.reactions?.[emoji] || [];
                const active = users.includes(userData.name);
                return (
                  <button key={emoji} onClick={() => toggleReaction(post.id, emoji, userData.name)} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: active ? 'rgba(200,240,74,0.15)' : 'var(--surface2)',
                    border: `1px solid ${active ? 'rgba(200,240,74,0.4)' : 'var(--border)'}`,
                    borderRadius: 20, padding: '5px 10px', cursor: 'pointer',
                    fontSize: 14, color: active ? 'var(--accent)' : 'var(--muted)',
                    transition: 'all 0.15s',
                  }}>
                    {emoji}
                    {users.length > 0 && <span style={{ fontSize: 11, fontFamily: 'Syne', fontWeight: 700 }}>{users.length}</span>}
                  </button>
                );
              })}
            </div>

            {/* Replies */}
            {post.replies?.length > 0 && (
              <div style={{ paddingLeft: 46, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {post.replies.map((r, ri) => (
                  <div key={ri} style={{
                    fontSize: 13, background: 'var(--surface2)',
                    borderRadius: 10, padding: '8px 12px', lineHeight: 1.4,
                  }}>
                    <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 12 }}>{r.name} </span>
                    <span style={{ color: 'var(--muted)' }}>{r.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Reply input */}
            <div style={{ paddingLeft: 46, display: 'flex', gap: 8 }}>
              <input
                value={replyInputs[post.id] || ''}
                onChange={e => setReplyInputs(r => ({ ...r, [post.id]: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && replyInputs[post.id]?.trim()) {
                    addReply(post.id, userData.name, replyInputs[post.id].trim());
                    setReplyInputs(r => ({ ...r, [post.id]: '' }));
                  }
                }}
                placeholder="Reply..."
                style={{
                  flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '8px 12px', color: 'var(--text)',
                  fontSize: 13, outline: 'none', fontFamily: 'DM Sans',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <button
                onClick={() => {
                  if (replyInputs[post.id]?.trim()) {
                    addReply(post.id, userData.name, replyInputs[post.id].trim());
                    setReplyInputs(r => ({ ...r, [post.id]: '' }));
                  }
                }}
                style={{
                  background: 'var(--accent)', border: 'none', borderRadius: 10,
                  padding: '8px 14px', cursor: 'pointer', fontFamily: 'Syne',
                  fontWeight: 800, fontSize: 14, color: '#000',
                }}>↑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── WRAPPED TAB ──────────────────────────────────────────────────────────────
function WrappedTab({ userData, members }) {
  const [started, setStarted] = useState(false);
  const [slide, setSlide] = useState(0);
  const [narrative, setNarrative] = useState('');
  const [loading, setLoading] = useState(false);

  const log = userData.currentLog || {};
  const history = userData.history || [];
  const archetype = getArchetype(log);
  const score = getBalanceScore(log);
  const myEmbed = userData.embedding || getEmbedding(log);

  const bestScore = Math.max(...history.map(h => h.balanceScore || 0), score);
  const totalWorkouts = history.reduce((s, h) => s + (h.workouts || 0), 0) + (log.workouts || 0);

  // Real friend compatibility using actual Firebase data
  const friendCompatibility = members
    .filter(m => m.uid !== userData.uid)
    .map(m => ({
      name: m.name,
      initials: m.initials,
      score: Math.round(cosineSimilarity(myEmbed, m.embedding || getEmbedding(m.currentLog || {})) * 100),
      archetype: m.archetype || 'Unknown',
      embed: m.embedding || getEmbedding(m.currentLog || {}),
    }))
    .sort((a, b) => b.score - a.score);

  const bestMatch = friendCompatibility[0];

  const start = async () => {
    setStarted(true);
    setSlide(0);
    setLoading(true);
    try {
      const res = await fetch('/api/wrapped', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log, archetype, balanceScore: score,
          compatibilities: friendCompatibility,
          userName: userData.name,
        }),
      });
      const data = await res.json();
      setNarrative(data.narrative);
    } catch {
      setNarrative(`This week, ${userData.name} showed up. Not perfect — but honest. That's what it takes.`);
    }
    setLoading(false);
  };

  const slides = [
    // 0 - intro
    {
      bg: 'radial-gradient(ellipse at 50% 30%, #152500 0%, #050505 70%)',
      content: (
        <div style={{ textAlign: 'center', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div style={{ fontSize: 60 }}>🎧</div>
          <div>
            <p style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 11, letterSpacing: 3, color: 'var(--accent)', marginBottom: 8 }}>YOUR WEEK IN REVIEW</p>
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 44, lineHeight: 1.1 }}>
              {userData.name}'s<br /><span style={{ color: 'var(--accent)' }}>Wrapped</span>
            </h1>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Tap to begin your story ✦</p>
        </div>
      ),
    },
    // 1 - stats
    {
      bg: 'var(--bg)',
      content: (
        <div style={{ padding: '48px 24px', width: '100%' }}>
          <p style={{ fontFamily: 'Syne', fontSize: 11, letterSpacing: 3, color: 'var(--muted)', marginBottom: 20 }}>THIS WEEK</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Workouts', val: log.workouts || 0, emoji: '💪', good: true },
              { label: 'Times ate out', val: log.ateOut || 0, emoji: '🍔', good: false },
              { label: 'Junk meals', val: log.junk || 0, emoji: '🌮', good: false },
              { label: 'Sugar days', val: log.sugar || 0, emoji: '🍬', good: false },
              { label: 'Sleep average', val: `${log.sleep || 7}h`, emoji: '😴', good: true },
            ].map(s => (
              <div key={s.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 18px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 14,
              }}>
                <span style={{ fontSize: 14 }}>{s.emoji} {s.label}</span>
                <span style={{
                  fontFamily: 'Syne', fontWeight: 800, fontSize: 22,
                  color: s.good ? 'var(--accent)' : (typeof s.val === 'number' && s.val > 3) ? 'var(--red)' : 'var(--text)',
                }}>{s.val}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    // 2 - score
    {
      bg: 'radial-gradient(ellipse at 50% 40%, #0a2000 0%, #050505 65%)',
      content: (
        <div style={{ textAlign: 'center', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <p style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 11, letterSpacing: 3, color: 'var(--accent)' }}>BALANCE SCORE</p>
          <div style={{ fontSize: 120, fontFamily: 'Syne', fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{score}</div>
          {bestScore > score && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Your best: <strong style={{ color: 'var(--text)' }}>{bestScore}</strong></p>}
          {bestScore <= score && history.length > 0 && <p style={{ color: 'var(--accent)', fontSize: 13 }}>↑ New personal best!</p>}
          {totalWorkouts > 0 && <p style={{ color: 'var(--muted)', fontSize: 15 }}>{totalWorkouts} total workouts logged</p>}
          <p style={{ color: 'var(--muted)', fontSize: 15, maxWidth: 250, lineHeight: 1.6 }}>
            {score >= 70 ? 'Top tier. Your habits are doing the heavy lifting.' : score >= 50 ? 'Solid foundation. Keep building.' : 'Rough week. But you showed up.'}
          </p>
        </div>
      ),
    },
    // 3 - archetype
    {
      bg: `radial-gradient(ellipse at 50% 40%, ${archetype.color}18 0%, #050505 65%)`,
      content: (
        <div style={{ textAlign: 'center', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <p style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 11, letterSpacing: 3, color: 'var(--muted)' }}>YOUR ARCHETYPE</p>
          <div style={{ fontSize: 72 }}>{archetype.emoji}</div>
          <div>
            <h2 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 30, color: archetype.color }}>{archetype.label}</h2>
            <p style={{ color: 'var(--muted)', fontSize: 15, maxWidth: 280, marginTop: 12, lineHeight: 1.6 }}>{archetype.desc}</p>
          </div>
        </div>
      ),
    },
    // 4 - real friend compatibility
    {
      bg: 'var(--bg)',
      content: (
        <div style={{ padding: '48px 24px', width: '100%' }}>
          <p style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 11, letterSpacing: 3, color: 'var(--muted)', marginBottom: 4 }}>LIFESTYLE MATCH</p>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 20 }}>Cosine similarity · 5D habit embedding</p>

          {friendCompatibility.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 14 }}>
              No friends in your circle yet — share your code to invite them!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {friendCompatibility.map((f, i) => (
                <div key={f.name} style={{
                  padding: '14px 18px', borderRadius: 14,
                  background: i === 0 ? 'rgba(200,240,74,0.06)' : 'var(--surface)',
                  border: `1px solid ${i === 0 ? 'rgba(200,240,74,0.35)' : 'var(--border)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <Avatar initials={f.initials} size={38} bg={i === 0 ? 'var(--accent)' : 'var(--surface2)'} color={i === 0 ? '#000' : 'var(--text)'} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15 }}>{f.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--muted)' }}>{f.archetype}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 26, color: i === 0 ? 'var(--accent)' : 'var(--text)' }}>{f.score}%</p>
                      <p style={{ fontSize: 10, color: 'var(--muted)' }}>match</p>
                    </div>
                  </div>
                  {/* Mini embedding bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {EMBED_LABELS.map((label, di) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--muted)', width: 42, flexShrink: 0 }}>{label}</span>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${myEmbed[di] * 100}%`, background: 'var(--accent)', borderRadius: 2 }} />
                          </div>
                          <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(f.embed?.[di] || 0) * 100}%`, background: '#60a5fa', borderRadius: 2 }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {bestMatch && (
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 16 }}>
              Closest lifestyle match: <strong style={{ color: 'var(--text)' }}>{bestMatch.name}</strong> at {bestMatch.score}%
            </p>
          )}
        </div>
      ),
    },
    // 5 - narrative
    {
      bg: 'radial-gradient(ellipse at 50% 30%, #001f12 0%, #050505 70%)',
      content: (
        <div style={{ textAlign: 'center', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <p style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 11, letterSpacing: 3, color: 'var(--accent)' }}>YOUR STORY</p>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                border: '3px solid var(--surface2)', borderTopColor: 'var(--accent)',
                animation: 'spin 0.9s linear infinite',
              }} />
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>Writing your narrative...</p>
            </div>
          ) : (
            <p style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 20, lineHeight: 1.65, maxWidth: 300 }}>
              "{narrative}"
            </p>
          )}
        </div>
      ),
    },
  ];

  if (!started) {
    return (
      <div style={{ padding: '24px 16px 100px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: 2, color: 'var(--muted)', fontFamily: 'Syne' }}>WEEKLY REVEAL</p>
          <h1 style={{ fontSize: 28, fontFamily: 'Syne', fontWeight: 800 }}>Wrapped</h1>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #0d0d0d 0%, #0c1a00 100%)',
          border: '1px solid rgba(200,240,74,0.15)', borderRadius: 24,
          padding: '32px 24px', textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}>
          <div style={{ fontSize: 48 }}>🎧</div>
          <h2 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 22 }}>Ready for your story?</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, maxWidth: 260 }}>
            Archetype, balance score, real friend compatibility from actual habit data, and an AI narrative.
          </p>
          <button onClick={start} style={{ ...btnStyle(true), width: '100%', padding: 16, fontSize: 16 }}>
            Generate My Wrapped ✦
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Balance Score', val: `${score}/100`, emoji: '📊' },
            { label: 'Archetype', val: archetype.emoji, emoji: archetype.emoji },
            { label: 'Best Match', val: bestMatch ? `${bestMatch.score}%` : '?', emoji: '🤝' },
            { label: 'AI Narrative', val: '✨', emoji: '✨' },
          ].map(c => (
            <div key={c.label} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 16, padding: '18px 16px', textAlign: 'center',
            }}>
              <p style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 20, color: 'var(--accent)' }}>{c.val}</p>
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{c.label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => slide < slides.length - 1 && setSlide(s => s + 1)}
      style={{
        height: 'calc(100vh - 80px)', overflow: 'hidden', position: 'relative',
        background: slides[slide].bg, cursor: slide < slides.length - 1 ? 'pointer' : 'default',
        transition: 'background 0.5s', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Progress */}
      <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', gap: 4, zIndex: 10 }}>
        {slides.map((_, i) => (
          <div key={i} onClick={e => { e.stopPropagation(); setSlide(i); }} style={{
            flex: 1, height: 3, borderRadius: 2, cursor: 'pointer',
            background: i <= slide ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Content */}
      <div key={slide} style={{ width: '100%', animation: 'slideUp 0.35s ease both' }}>
        {slides[slide].content}
      </div>

      {slide < slides.length - 1 && (
        <p style={{
          position: 'absolute', bottom: 20, left: 0, right: 0,
          textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)',
          fontFamily: 'Syne', letterSpacing: 1,
        }}>TAP TO CONTINUE</p>
      )}

      {slide === slides.length - 1 && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 20, left: 16, right: 16 }}>
          <button onClick={() => { setStarted(false); setSlide(0); }} style={{ ...btnStyle(true), width: '100%', padding: 14, fontSize: 15 }}>
            ← Back
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [uid, setUid] = useState(null);
  const [userData, setUserData] = useState(null);
  const [tab, setTab] = useState('hub');
  const [log, setLog] = useState({ sugar: 0, ateOut: 0, junk: 0, workouts: 0, sleep: 7 });
  const [members, setMembers] = useState([]);
  const [feed, setFeed] = useState([]);
  const [circleName, setCircleName] = useState('');
  const [circleCode, setCircleCode] = useState('');
  const [newCircleCode, setNewCircleCode] = useState(null);
  const [saving, setSaving] = useState(false);

  const membersUnsub = useRef(null);
  const feedUnsub = useRef(null);

  // Auth listener
  useEffect(() => {
    const unsub = onAuth(async (firebaseUser) => {
      if (firebaseUser) {
        setUid(firebaseUser.uid);
        const u = await getUser(firebaseUser.uid);
        if (u) {
          setUserData(u);
          setLog(u.currentLog || { sugar: 0, ateOut: 0, junk: 0, workouts: 0, sleep: 7 });
          if (u.circleId) subscribeToCircle(u.circleId);
        }
      } else {
        // Auto sign in anonymously
        try {
          const user = await signIn();
          setUid(user.uid);
        } catch (e) {
          console.error('Auth error:', e);
        }
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Auto-save log changes to Firestore (debounced)
  const saveTimeout = useRef(null);
  useEffect(() => {
    if (!uid || !userData) return;
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      updateUserLog(uid, log).then(({ balanceScore, embedding }) => {
        setUserData(u => ({ ...u, currentLog: log, balanceScore, embedding }));
      });
    }, 800);
    return () => clearTimeout(saveTimeout.current);
  }, [log]);

  const subscribeToCircle = useCallback((cId) => {
    if (membersUnsub.current) membersUnsub.current();
    if (feedUnsub.current) feedUnsub.current();

    membersUnsub.current = onCircleMembers(cId, (mems) => {
      setMembers(mems);
    });

    feedUnsub.current = onFeed(cId, (posts) => {
      setFeed(posts);
    });
  }, []);

  const handleOnboard = async ({ code }) => {
    const u = await getUser(uid);
    setUserData(u);
    setLog(u.currentLog || { sugar: 0, ateOut: 0, junk: 0, workouts: 0, sleep: 7 });
    if (u.circleId) {
      subscribeToCircle(u.circleId);
      // Fetch circle name
      const { getDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const circleSnap = await getDoc(doc(db, 'circles', u.circleId));
      if (circleSnap.exists()) {
        setCircleName(circleSnap.data().name);
        setCircleCode(u.circleId);
      }
    }
    if (code) {
      setNewCircleCode(code);
      setCircleCode(code);
    }
  };

  // Load circle name on app start once userData has circleId
  useEffect(() => {
    if (!userData?.circleId || circleName) return;
    (async () => {
      const { getDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const snap = await getDoc(doc(db, 'circles', userData.circleId));
      if (snap.exists()) {
        setCircleName(snap.data().name);
        setCircleCode(userData.circleId);
      }
    })();
  }, [userData?.circleId]);

  const handlePost = async () => {
    if (!userData?.circleId) return;
    setSaving(true);
    const shoutout = generateShoutout(userData.name, log, userData.history || []);
    await postToFeed(userData.circleId, uid, userData.name, userData.initials, shoutout);
    await commitWeek(uid, log);
    const updated = await getUser(uid);
    setUserData(updated);
    setLog({ sugar: 0, ateOut: 0, junk: 0, workouts: 0, sleep: 7 });
    setSaving(false);
    setTab('circle');
  };

  // Loading
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.9s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Onboarding
  if (!userData || !userData.circleId) {
    return <Onboarding uid={uid} onDone={handleOnboard} />;
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {newCircleCode && (
        <CircleCodeModal
          code={newCircleCode}
          circleName={circleName}
          onClose={() => setNewCircleCode(null)}
        />
      )}
      {tab === 'hub' && <HubTab userData={userData} log={log} setLog={setLog} onLog={handlePost} saving={saving} />}
      {tab === 'circle' && <CircleTab userData={userData} members={members} feed={feed} circleName={circleName} circleCode={circleCode} />}
      {tab === 'wrapped' && <WrappedTab userData={userData} members={members} />}
      <TabBar tab={tab} setTab={setTab} />
    </div>
  );
}
