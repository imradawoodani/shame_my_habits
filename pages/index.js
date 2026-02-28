import { useState, useEffect, useRef } from "react";
import {
  getEmbedding, cosineSimilarity, getBalanceScore,
  getArchetype, getTrends, generateShoutout,
  SEED_FRIENDS, CIRCLE_NAME,
} from "../lib/ml";
import {
  getUser, saveUser, isOnboarded, setOnboarded,
  getCurrentLog, saveCurrentLog, getHistory, commitDay,
  getFeed, saveFeed,
} from "../lib/store";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const REACTIONS = ["🔥", "💀", "👑", "😭", "💪"];

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Avatar({ initials, size = 36, color = "var(--accent)" }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: color, display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: "Syne", fontWeight: 800,
      fontSize: size * 0.38, color: "#000", flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

// ─── COUNTER ─────────────────────────────────────────────────────────────────
function Counter({ label, emoji, value, onChange, max = Infinity, unit = "/ day" }) {
  const tap = (delta) => {
    const next = Math.max(0, Math.min(max, value + delta));
    onChange(next);
  };
  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <span>{emoji}</span>
        <span style={{ fontFamily: "Syne", fontWeight: 600 }}>{label}</span>
        <span style={{ marginLeft: "auto", color: "var(--border)", fontSize: 11 }}>{unit}</span>
      </p>
      <div style={{
        display: "flex", alignItems: "center", gap: 0,
        background: "var(--surface2)", border: "1px solid var(--border)",
        borderRadius: 12, overflow: "hidden",
      }}>
        <button onClick={() => tap(-1)} style={{
          width: 48, height: 48, border: "none", background: "transparent",
          color: "var(--muted)", fontSize: 20, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.1s",
        }}
          onMouseDown={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          onMouseUp={e => e.currentTarget.style.background = "transparent"}
        >−</button>
        <span style={{
          flex: 1, textAlign: "center", fontFamily: "Syne",
          fontWeight: 800, fontSize: 22,
        }}>{value}</span>
        <button onClick={() => tap(1)} style={{
          width: 48, height: 48, border: "none",
          background: value === max ? "var(--surface2)" : "var(--accent)",
          color: value === max ? "var(--muted)" : "#000",
          fontSize: 20, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s",
        }}>+</button>
      </div>
    </div>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function Onboarding({ onDone }) {
  const [name, setName] = useState("");
  const [step, setStep] = useState(0);

  const handleSubmit = () => {
    if (!name.trim()) return;
    saveUser({ name: name.trim(), initials: name.trim()[0].toUpperCase() });
    setOnboarded();
    onDone({ name: name.trim(), initials: name.trim()[0].toUpperCase() });
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "32px 24px", gap: 32,
      background: "radial-gradient(ellipse at 50% 0%, #1a2a0a 0%, var(--bg) 60%)",
    }}>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 56 }}>🎧</div>
        <h1 style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 36, lineHeight: 1.1 }}>
          Habit<span style={{ color: "var(--accent)" }}>Wrapped</span>
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 15, maxWidth: 280, margin: "0 auto", lineHeight: 1.6 }}>
          Spotify Wrapped for your lifestyle. Track habits, get shoutouts, see your archetype.
        </p>
      </div>

      <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ fontSize: 13, fontFamily: "Syne", fontWeight: 600, color: "var(--muted)" }}>
          What should we call you?
        </label>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          placeholder="Your first name"
          style={{
            width: "100%", padding: "14px 18px",
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 12, color: "var(--text)", fontSize: 16,
            fontFamily: "DM Sans", outline: "none",
            transition: "border-color 0.2s",
          }}
          onFocus={e => e.target.style.borderColor = "var(--accent)"}
          onBlur={e => e.target.style.borderColor = "var(--border)"}
        />
        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          style={{
            padding: "14px", background: name.trim() ? "var(--accent)" : "var(--surface)",
            color: name.trim() ? "#000" : "var(--muted)", border: "none",
            borderRadius: 12, fontFamily: "Syne", fontWeight: 700, fontSize: 15,
            cursor: name.trim() ? "pointer" : "default", transition: "all 0.2s",
          }}
        >
          Join {CIRCLE_NAME} →
        </button>
      </div>

      <div style={{ display: "flex", gap: 24, color: "var(--muted)", fontSize: 12 }}>
        {["📊 Balance Score", "🏆 Leaderboard", "🎧 Daily Wrapped"].map(f => (
          <span key={f}>{f}</span>
        ))}
      </div>
    </div>
  );
}

// ─── TAB BAR ─────────────────────────────────────────────────────────────────
function TabBar({ tab, setTab }) {
  const tabs = [
    { id: "hub", label: "My Hub", icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9,22 9,12 15,12 15,22"/>
      </svg>
    )},
    { id: "circle", label: "Circle", icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    )},
    { id: "wrapped", label: "Wrapped", icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
      </svg>
    )},
  ];
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      width: "100%", maxWidth: 430, background: "rgba(8,8,8,0.96)",
      backdropFilter: "blur(16px)", borderTop: "1px solid var(--border)",
      display: "flex", justifyContent: "space-around", padding: "10px 0 20px",
      zIndex: 100,
    }}>
      {tabs.map(({ id, label, icon }) => {
        const active = tab === id;
        return (
          <button key={id} onClick={() => setTab(id)} style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 4, background: "none", border: "none", cursor: "pointer",
            color: active ? "var(--accent)" : "var(--muted)",
            transition: "color 0.15s", padding: "4px 20px",
            fontFamily: "Syne", fontSize: 11, fontWeight: active ? 700 : 400,
          }}>
            {icon(active)}
            {label}
          </button>
        );
      })}
    </nav>
  );
}

// ─── HUB TAB ─────────────────────────────────────────────────────────────────
function HubTab({ user, log, setLog, history, onLog }) {
  const score = getBalanceScore(log);
  const archetype = getArchetype(log);
  const trends = getTrends(log, history);
  const [justLogged, setJustLogged] = useState(false);

  const handleLog = () => {
    onLog();
    setJustLogged(true);
    setTimeout(() => setJustLogged(false), 3000);
  };

  return (
    <div style={{ padding: "24px 16px 100px", display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div>
        <p style={{ color: "var(--muted)", fontSize: 12, fontFamily: "Syne", letterSpacing: 2 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toUpperCase()}
        </p>
        <h1 style={{ fontSize: 30, fontFamily: "Syne", fontWeight: 800 }}>
          Hey, {user.name} 👋
        </h1>
      </div>

      {/* Score card */}
      <div style={{
        background: `linear-gradient(135deg, #0d1f00 0%, #1a3500 100%)`,
        border: "1px solid var(--accent)33",
        borderRadius: 20, padding: 20,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <p style={{ fontSize: 11, fontFamily: "Syne", fontWeight: 700, color: "var(--accent)", letterSpacing: 2 }}>BALANCE SCORE</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 64, fontFamily: "Syne", fontWeight: 800, color: "var(--accent)", lineHeight: 1 }}>{score}</span>
            <span style={{ color: "var(--muted)", fontSize: 14 }}>/100</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            {score >= 70 ? "You're crushing it" : score >= 50 ? "Solid day" : "Room to improve"}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 40 }}>{archetype.emoji}</div>
          <p style={{ fontSize: 11, fontFamily: "Syne", fontWeight: 700, color: archetype.color, maxWidth: 110, textAlign: "right", lineHeight: 1.3, marginTop: 4 }}>
            {archetype.label}
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {[
          { val: log.workouts, label: "Workouts", isGood: true },
          { val: log.ateOut, label: "Ate Out", isGood: false },
          { val: log.sleep + "h", label: "Sleep", isGood: true },
        ].map(s => (
          <div key={s.label} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 14, padding: "14px 12px",
          }}>
            <p style={{
              fontFamily: "Syne", fontWeight: 800, fontSize: 24,
              color: s.isGood ? "var(--accent)" : (typeof s.val === "number" && s.val > 3) ? "var(--red)" : "var(--text)",
            }}>{s.val}</p>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Trends */}
      {trends.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {trends.map((t, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8,
              background: t.good ? "rgba(200,240,74,0.08)" : "rgba(255,82,82,0.08)",
              border: `1px solid ${t.good ? "rgba(200,240,74,0.2)" : "rgba(255,82,82,0.2)"}`,
              borderRadius: 10, padding: "8px 12px", fontSize: 13,
            }}>
              <span>{t.good ? "↑" : "↓"}</span>
              <span style={{ color: t.good ? "var(--accent)" : "var(--red)" }}>{t.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Log form */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", gap: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 17 }}>Log Today</h2>
          {history.length > 0 && (
            <span style={{ fontSize: 11, color: "var(--muted)", background: "var(--surface2)", padding: "3px 8px", borderRadius: 6 }}>
              Day {history.length + 1}
            </span>
          )} 
        </div>

        <Counter label="Sugar meals" emoji="🍬" value={log.sugar} onChange={v => { const l = {...log, sugar: v}; setLog(l); saveCurrentLog(l); }} />
        <Counter label="Ate out" emoji="🍔" value={log.ateOut} onChange={v => { const l = {...log, ateOut: v}; setLog(l); saveCurrentLog(l); }} />
        <Counter label="Junk food" emoji="🌮" value={log.junk} onChange={v => { const l = {...log, junk: v}; setLog(l); saveCurrentLog(l); }} />
        <Counter label="Workouts" emoji="💪" value={log.workouts} onChange={v => { const l = {...log, workouts: v}; setLog(l); saveCurrentLog(l); }} max={10} />
        <Counter label="Sleep avg" emoji="😴" value={log.sleep} onChange={v => { const l = {...log, sleep: v}; setLog(l); saveCurrentLog(l); }} max={24} unit="hrs" />

        <button
          onClick={handleLog}
          style={{
            padding: "14px", marginTop: 4,
            background: justLogged ? "var(--surface2)" : "var(--accent)",
            color: justLogged ? "var(--accent)" : "#000",
            border: justLogged ? "1px solid var(--accent)" : "none",
            borderRadius: 12, fontFamily: "Syne", fontWeight: 700, fontSize: 15,
            cursor: "pointer", transition: "all 0.3s",
          }}
        >
          {justLogged ? "✓ Posted to Circle!" : "Post to Circle →"}
        </button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <h2 style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Past Days</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.slice(0, 4).map((h, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "12px 16px",
              }}>
                <div>
                  <p style={{ fontSize: 13, fontFamily: "Syne", fontWeight: 600 }}>{h.day || `Day ${history.length - i}`}</p>
                  <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {h.workouts} workouts · {h.ateOut}x out · {h.sleep}h sleep
                  </p>
                </div>
                <span style={{
                  fontFamily: "Syne", fontWeight: 800, fontSize: 20,
                  color: getBalanceScore(h) >= 60 ? "var(--accent)" : "var(--muted)",
                }}>{getBalanceScore(h)}</span>
              </div>
            ))} 
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CIRCLE TAB ──────────────────────────────────────────────────────────────
function CircleTab({ feed, setFeed, myLog, user, history }) {
  const [replyInputs, setReplyInputs] = useState({});
  const [showLeaderboard, setShowLeaderboard] = useState(true);

  // choose which log to show for the user: if the current unsaved log is
  // higher than the last published entry, use it; otherwise show history[0]
  const userLog = (() => {
    if (!history || history.length === 0) return myLog;
    const last = history[0];
    return getBalanceScore(myLog) > getBalanceScore(last) ? myLog : last;
  })();

  const allUsers = [
    { name: user.name, initials: user.initials || user.name[0], log: userLog },
    ...SEED_FRIENDS.map(f => ({ name: f.name, initials: f.initials, log: f.log })),
  ].map(u => ({ ...u, score: getBalanceScore(u.log) }))
    .sort((a, b) => b.score - a.score);

  const medals = ["🥇", "🥈", "🥉"];

  const toggleReaction = (postId, emoji) => {
    const updated = feed.map(p => {
      if (p.id !== postId) return p;
      const reactions = { ...(p.reactions || {}) };
      const users = reactions[emoji] || [];
      if (users.includes(user.name)) {
        reactions[emoji] = users.filter(u => u !== user.name);
        if (!reactions[emoji].length) delete reactions[emoji];
      } else {
        reactions[emoji] = [...users, user.name];
      }
      return { ...p, reactions };
    });
    setFeed(updated);
    saveFeed(updated);
  };

  const addReply = (postId, text) => {
    if (!text.trim()) return;
    const updated = feed.map(p =>
      p.id === postId
        ? { ...p, replies: [...(p.replies || []), { name: user.name, text: text.trim() }] }
        : p
    );
    setFeed(updated);
    saveFeed(updated);
    setReplyInputs(r => ({ ...r, [postId]: "" }));
  };

  return (
    <div style={{ padding: "24px 16px 100px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <p style={{ color: "var(--muted)", fontSize: 12, fontFamily: "Syne", letterSpacing: 2 }}>YOUR CIRCLE</p>
        <h1 style={{ fontSize: 28, fontFamily: "Syne", fontWeight: 800 }}>{CIRCLE_NAME}</h1>
      </div>

      {/* Leaderboard */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 20, overflow: "hidden",
      }}>
        <div
          onClick={() => setShowLeaderboard(!showLeaderboard)}
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "16px 20px", cursor: "pointer",
          }}
        >
          <h2 style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16 }}>🏆 Leaderboard</h2>
          <span style={{ color: "var(--accent)", fontSize: 13, fontFamily: "Syne" }}>
            {showLeaderboard ? "▲" : "▼"}
          </span>
        </div>
        {showLeaderboard && (
          <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
            {allUsers.map((u, i) => (
              <div key={u.name} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px",
                background: u.name === user.name ? "rgba(200,240,74,0.06)" : "var(--surface2)",
                border: `1px solid ${u.name === user.name ? "rgba(200,240,74,0.25)" : "var(--border)"}`,
                borderRadius: 12,
              }}>
                <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{medals[i] || `${i+1}`}</span>
                <Avatar
                  initials={u.initials}
                  size={32}
                  color={i === 0 ? "var(--accent)" : "var(--surface)"}
                />
                <span style={{ flex: 1, fontFamily: "Syne", fontWeight: 600, fontSize: 14 }}>
                  {u.name} {u.name === user.name && <span style={{ color: "var(--muted)", fontWeight: 400 }}>(you)</span>}
                </span>
                <span style={{
                  fontFamily: "Syne", fontWeight: 800, fontSize: 18,
                  color: i === 0 ? "var(--accent)" : "var(--text)",
                }}>{u.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feed */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16 }}>Circle Feed</h2>
        {feed.length === 0 && (
          <div style={{
            textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 14,
            background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)",
          }}>
            No posts yet. Log your day to kick things off. 👆
          </div>
        )}
        {feed.map((post) => (
          <div key={post.id} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 12,
          }}>
            {/* Post header */}
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Avatar initials={post.initials} size={36} color={
                post.initials === (user.initials || user.name[0]) ? "var(--accent)" : "var(--surface2)"
              } />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 13 }}>{post.name}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    {post.ts ? timeAgo(post.ts) : post.time}
                  </span>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.55, marginTop: 4, color: "var(--text)" }}>
                  {post.message}
                </p>
              </div>
            </div>

            {/* Reactions */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingLeft: 46 }}>
              {REACTIONS.map(emoji => {
                const users = post.reactions?.[emoji] || [];
                const active = users.includes(user.name);
                return (
                  <button key={emoji} onClick={() => toggleReaction(post.id, emoji)} style={{
                    display: "flex", alignItems: "center", gap: 4,
                    background: active ? "rgba(200,240,74,0.15)" : "var(--surface2)",
                    border: `1px solid ${active ? "var(--accent)44" : "var(--border)"}`,
                    borderRadius: 20, padding: "4px 10px", cursor: "pointer",
                    fontSize: 13, color: active ? "var(--accent)" : "var(--muted)",
                    transition: "all 0.15s",
                  }}>
                    {emoji}
                    {users.length > 0 && <span style={{ fontSize: 11 }}>{users.length}</span>}
                  </button>
                );
              })}
            </div>

            {/* Replies */}
            {post.replies?.length > 0 && (
              <div style={{ paddingLeft: 46, display: "flex", flexDirection: "column", gap: 6 }}>
                {post.replies.map((r, ri) => (
                  <div key={ri} style={{
                    fontSize: 13, background: "var(--surface2)",
                    borderRadius: 10, padding: "8px 12px", lineHeight: 1.4,
                  }}>
                    <span style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 12 }}>{r.name} </span>
                    <span style={{ color: "var(--muted)" }}>{r.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Reply input */}
            <div style={{ paddingLeft: 46, display: "flex", gap: 8 }}>
              <input
                value={replyInputs[post.id] || ""}
                onChange={e => setReplyInputs(r => ({ ...r, [post.id]: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addReply(post.id, replyInputs[post.id] || "")}
                placeholder="Reply..."
                style={{
                  flex: 1, background: "var(--surface2)", border: "1px solid var(--border)",
                  borderRadius: 10, padding: "8px 12px", color: "var(--text)",
                  fontSize: 13, outline: "none", fontFamily: "DM Sans",
                }}
                onFocus={e => e.target.style.borderColor = "var(--accent)"}
                onBlur={e => e.target.style.borderColor = "var(--border)"}
              />
              <button
                onClick={() => addReply(post.id, replyInputs[post.id] || "")}
                style={{
                  background: "var(--accent)", border: "none", borderRadius: 10,
                  padding: "8px 14px", cursor: "pointer", fontFamily: "Syne",
                  fontWeight: 700, fontSize: 13, color: "#000",
                }}
              >↑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── WRAPPED TAB ──────────────────────────────────────────────────────────────
function WrappedTab({ myLog, user, history }) {
  const [started, setStarted] = useState(false);
  const [slide, setSlide] = useState(0);
  const [narrative, setNarrative] = useState(null);
  const [loading, setLoading] = useState(false);

  const archetype = getArchetype(myLog);
  const score = getBalanceScore(myLog);
  const myVec = getEmbedding(myLog);
  const compatibilities = SEED_FRIENDS
    .map(f => ({ name: f.name, initials: f.initials, score: Math.round(cosineSimilarity(myVec, getEmbedding(f.log)) * 100) }))
    .sort((a, b) => b.score - a.score);

  const totalWorkouts = history.reduce((s, h) => s + (h.workouts || 0), 0) + myLog.workouts;
  const bestScore = Math.max(...history.map(h => getBalanceScore(h)), score);

  const start = async () => {
    setStarted(true);
    setSlide(0);
    setLoading(true);
    try {
      const res = await fetch("/api/wrapped", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log: myLog, archetype, balanceScore: score, compatibilities, userName: user.name }),
      });
      const data = await res.json();
      setNarrative(data.narrative);
    } catch {
      setNarrative(`Today, ${user.name} showed up. Not perfect — but consistent. The best habits are built in moments like this.`);
    }
    setLoading(false);
  };

  const slides = [
    // 0 — Intro
    { bg: "radial-gradient(ellipse at 50% 30%, #1a2a0a 0%, #050505 70%)", content: (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 60 }}>🎧</div>
        <div>
          <p style={{ fontSize: 12, letterSpacing: 3, color: "var(--accent)", fontFamily: "Syne", fontWeight: 700, marginBottom: 8 }}>
            YOUR WEEK IN REVIEW
          </p>
          <h1 style={{ fontSize: 44, fontFamily: "Syne", fontWeight: 800, lineHeight: 1.1 }}>
            {user.name}'s<br /><span style={{ color: "var(--accent)" }}>Wrapped</span>
          </h1>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Tap to begin your story ✦</p>
      </div>
    )},
    // 1 — Stats
    { bg: "var(--bg)", content: (
      <div style={{ padding: "40px 24px", width: "100%" }}>
        <p style={{ fontSize: 11, letterSpacing: 3, color: "var(--muted)", fontFamily: "Syne", marginBottom: 24 }}>TODAY</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { label: "Workouts", val: myLog.workouts, emoji: "💪", good: true, compare: `vs avg ${Math.round(history.reduce((s,h)=>s+(h.workouts||0),0)/(history.length||1))}` },
            { label: "Times ate out", val: myLog.ateOut, emoji: "🍔", good: false },
            { label: "Junk meals", val: myLog.junk, emoji: "🌮", good: false },
            { label: "Sugar days", val: myLog.sugar, emoji: "🍬", good: false },
            { label: "Sleep average", val: `${myLog.sleep}h`, emoji: "😴", good: true },
          ].map(s => (
            <div key={s.label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "14px 20px", background: "var(--surface)",
              border: "1px solid var(--border)", borderRadius: 14,
            }}>
              <span style={{ fontSize: 14 }}>{s.emoji} {s.label}</span>
              <div style={{ textAlign: "right" }}>
                <span style={{
                  fontFamily: "Syne", fontWeight: 800, fontSize: 22,
                  color: s.good ? "var(--accent)" : (typeof s.val === "number" && s.val > 3) ? "var(--red)" : "var(--text)",
                }}>{s.val}</span>
                {s.compare && <p style={{ fontSize: 10, color: "var(--muted)" }}>{s.compare}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    )},
    // 2 — Score
    { bg: "radial-gradient(ellipse at 50% 40%, #0a2000 0%, #050505 65%)", content: (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center", padding: 32 }}>
        <p style={{ fontSize: 11, letterSpacing: 3, color: "var(--accent)", fontFamily: "Syne", fontWeight: 700 }}>BALANCE SCORE</p>
        <div style={{ fontSize: 120, fontFamily: "Syne", fontWeight: 800, color: "var(--accent)", lineHeight: 1 }}>{score}</div>
        {bestScore > score && (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Your best was <span style={{ color: "var(--text)" }}>{bestScore}</span></p>
        )}
        {bestScore <= score && history.length > 0 && (
          <p style={{ fontSize: 13, color: "var(--accent)" }}>↑ Your personal best!</p>
        )}
        {totalWorkouts > 0 && (
          <p style={{ fontSize: 15, color: "var(--muted)" }}>{totalWorkouts} total workouts logged so far</p>
        )}
        <p style={{ fontSize: 16, color: "var(--muted)", maxWidth: 260, lineHeight: 1.6 }}>
          {score >= 70 ? "Top tier. Your habits are doing the heavy lifting." : score >= 50 ? "Solid foundation. Keep building." : "Rough day. But you showed up."}
        </p>
      </div>
    )},
    // 3 — Archetype
    { bg: `radial-gradient(ellipse at 50% 40%, ${archetype.color}15 0%, #050505 65%)`, content: (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center", padding: 32 }}>
        <p style={{ fontSize: 11, letterSpacing: 3, color: "var(--muted)", fontFamily: "Syne" }}>YOUR ARCHETYPE</p>
        <div style={{ fontSize: 72 }}>{archetype.emoji}</div>
        <div>
          <h2 style={{ fontSize: 30, fontFamily: "Syne", fontWeight: 800, color: archetype.color, lineHeight: 1.2 }}>
            {archetype.label}
          </h2>
          <p style={{ fontSize: 15, color: "var(--muted)", maxWidth: 280, marginTop: 12, lineHeight: 1.6 }}>
            {archetype.desc}
          </p>
        </div>
      </div>
    )},
    // 4 — Compatibility
    { bg: "var(--bg)", content: (
      <div style={{ padding: "40px 24px", width: "100%" }}>
        <p style={{ fontSize: 11, letterSpacing: 3, color: "var(--muted)", fontFamily: "Syne", marginBottom: 6 }}>LIFESTYLE MATCH</p>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 24 }}>Based on lifestyle embeddings — cosine similarity of your 5D habit vectors</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {compatibilities.map((c, i) => (
            <div key={c.name} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 18px", borderRadius: 14,
              background: i === 0 ? "rgba(200,240,74,0.06)" : "var(--surface)",
              border: `1px solid ${i === 0 ? "var(--accent)44" : "var(--border)"}`,
            }}>
              <Avatar initials={c.initials} size={38} color={i === 0 ? "var(--accent)" : "var(--surface2)"} />
              <span style={{ flex: 1, fontFamily: "Syne", fontWeight: 600 }}>{c.name}</span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 22, color: i === 0 ? "var(--accent)" : "var(--text)" }}>
                  {c.score}%
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>compatible</div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, marginTop: 16 }}>
          Your closest lifestyle match is <strong style={{ color: "var(--text)" }}>{compatibilities[0]?.name}</strong>
        </p>
      </div>
    )},
    // 5 — Narrative
    { bg: "radial-gradient(ellipse at 50% 30%, #001f12 0%, #050505 70%)", content: (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center", padding: 40 }}>
        <p style={{ fontSize: 11, letterSpacing: 3, color: "var(--accent)", fontFamily: "Syne", fontWeight: 700 }}>YOUR STORY</p>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              border: "3px solid var(--surface2)", borderTopColor: "var(--accent)",
              animation: "spin 0.9s linear infinite",
            }} />
            <p style={{ color: "var(--muted)", fontSize: 14 }}>Writing your narrative...</p>
          </div>
        ) : (
          <p style={{
            fontSize: 20, fontFamily: "Syne", fontWeight: 700,
            lineHeight: 1.6, maxWidth: 300, color: "var(--text)",
          }}>
            "{narrative}"
          </p>
        )}
      </div>
    )},
  ];

  if (!started) {
    return (
      <div style={{ padding: "24px 16px 100px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <p style={{ color: "var(--muted)", fontSize: 12, fontFamily: "Syne", letterSpacing: 2 }}>DAILY REVEAL</p>
          <h1 style={{ fontSize: 28, fontFamily: "Syne", fontWeight: 800 }}>Wrapped</h1>
        </div>

        <div style={{
          background: "linear-gradient(135deg, #0d0d0d 0%, #0d1a00 100%)",
          border: "1px solid var(--accent)22",
          borderRadius: 24, padding: "32px 24px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center",
        }}>
          <div style={{ fontSize: 48 }}>🎧</div>
          <h2 style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 24 }}>Ready for your story?</h2>
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, maxWidth: 260 }}>
            Your archetype, balance score, friend compatibility, and an AI-generated personal narrative — all in one reveal.
          </p>
          <button onClick={start} style={{
            marginTop: 8, width: "100%", padding: 16,
            background: "var(--accent)", color: "#000", border: "none",
            borderRadius: 14, fontFamily: "Syne", fontWeight: 800, fontSize: 16, cursor: "pointer",
          }}>
            Generate My Wrapped ✦
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "Balance Score", val: `${score}/100`, emoji: "📊" },
            { label: "Archetype", val: archetype.label.split(" ").slice(-1)[0], emoji: archetype.emoji },
            { label: "Best Match", val: compatibilities[0] ? `${compatibilities[0].score}%` : "?", emoji: "🤝" },
            { label: "Narrative", val: "AI-generated", emoji: "✨" },
          ].map(c => (
            <div key={c.label} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 16, padding: "18px 16px", textAlign: "center",
            }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{c.emoji}</div>
              <p style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 18, color: "var(--accent)" }}>{c.val}</p>
              <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{c.label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const current = slides[slide];
  return (
    <div
      onClick={() => slide < slides.length - 1 && setSlide(s => s + 1)}
      style={{
        height: "calc(100vh - 80px)", overflow: "hidden", position: "relative",
        background: current.bg, cursor: slide < slides.length - 1 ? "pointer" : "default",
        transition: "background 0.5s",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {/* Progress */}
      <div style={{ position: "absolute", top: 16, left: 16, right: 16, display: "flex", gap: 4, zIndex: 10 }}>
        {slides.map((_, i) => (
          <div key={i} onClick={e => { e.stopPropagation(); setSlide(i); }} style={{
            flex: 1, height: 3, borderRadius: 2, cursor: "pointer",
            background: i <= slide ? "var(--accent)" : "rgba(255,255,255,0.15)",
            transition: "background 0.3s",
          }} />
        ))}
      </div>

      {/* Slide content */}
      <div key={slide} style={{
        width: "100%", animation: "slideUp 0.35s ease both",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {current.content}
      </div>

      {/* Hint */}
      {slide < slides.length - 1 && (
        <p style={{
          position: "absolute", bottom: 24, left: 0, right: 0,
          textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)",
          fontFamily: "Syne", letterSpacing: 1,
        }}>TAP TO CONTINUE</p>
      )}
      {slide === slides.length - 1 && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ position: "absolute", bottom: 24, left: 16, right: 16 }}
        >
          <button onClick={() => setStarted(false)} style={{
            width: "100%", padding: 14, background: "var(--accent)",
            color: "#000", border: "none", borderRadius: 14,
            fontFamily: "Syne", fontWeight: 800, fontSize: 15, cursor: "pointer",
          }}>
            Back to Hub
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboardedState] = useState(false);
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("hub");
  const [log, setLog] = useState({ sugar: 0, ateOut: 0, junk: 0, workouts: 0, sleep: 7 });
  const [history, setHistory] = useState([]);
  const [feed, setFeed] = useState([]);

  // Load from localStorage on mount
  useEffect(() => {
    const ob = isOnboarded();
    setOnboardedState(ob);
    if (ob) {
      setUser(getUser());
      setLog(getCurrentLog());
      setHistory(getHistory());
      setFeed(getFeed());
    }
    setReady(true);
  }, []);

  const handleOnboard = (u) => {
    setUser(u);
    setOnboardedState(true);
    setLog(getCurrentLog());
    setHistory(getHistory());
    setFeed(getFeed());
  };

  const handlePublish = () => {
    const shoutout = generateShoutout(user.name, log, history);
    const newPost = {
      id: `post_${Date.now()}`,
      initials: user.initials || user.name[0],
      name: user.name,
      message: shoutout,
      ts: Date.now(),
      reactions: {},
      replies: [],
    };
    const updatedFeed = [newPost, ...feed];
    setFeed(updatedFeed);
    saveFeed(updatedFeed);

    // Commit day to history
    commitDay(log);
    const newHistory = getHistory();
    setHistory(newHistory);
    setLog({ sugar: 0, ateOut: 0, junk: 0, workouts: 0, sleep: 7 });
    setTab("circle");
  }; 

  if (!ready) return null;
  if (!onboarded) return <Onboarding onDone={handleOnboard} />;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      {tab === "hub" && <HubTab user={user} log={log} setLog={setLog} history={history} onLog={handlePublish} />}
      {tab === "circle" && <CircleTab feed={feed} setFeed={setFeed} myLog={log} user={user} history={history} />}
      {tab === "wrapped" && <WrappedTab myLog={log} user={user} history={history} />}
      <TabBar tab={tab} setTab={setTab} />
    </div>
  );
}
