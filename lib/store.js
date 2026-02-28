// ─── PERSISTENCE ─────────────────────────────────────────────────────────────
// All data lives in localStorage. No backend required.

const KEYS = {
  USER: "hw_user",
  CURRENT_LOG: "hw_current_log",
  HISTORY: "hw_history",
  FEED: "hw_feed",
  ONBOARDED: "hw_onboarded",
};

const DEFAULT_LOG = { sugar: 0, ateOut: 0, junk: 0, workouts: 0, sleep: 7 };

export function getUser() {
  try {
    const raw = localStorage.getItem(KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveUser(user) {
  localStorage.setItem(KEYS.USER, JSON.stringify(user));
}

export function isOnboarded() {
  return localStorage.getItem(KEYS.ONBOARDED) === "true";
}

export function setOnboarded() {
  localStorage.setItem(KEYS.ONBOARDED, "true");
}

export function getCurrentLog() {
  try {
    const raw = localStorage.getItem(KEYS.CURRENT_LOG);
    return raw ? JSON.parse(raw) : { ...DEFAULT_LOG };
  } catch { return { ...DEFAULT_LOG }; }
}

export function saveCurrentLog(log) {
  localStorage.setItem(KEYS.CURRENT_LOG, JSON.stringify(log));
}

export function getHistory() {
  try {
    const raw = localStorage.getItem(KEYS.HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function commitWeek(log) {
  const history = getHistory();
  history.unshift({ ...log, week: getWeekLabel() });
  if (history.length > 12) history.pop(); // keep 12 weeks
  localStorage.setItem(KEYS.HISTORY, JSON.stringify(history));
  saveCurrentLog({ ...DEFAULT_LOG });
}

export function getFeed() {
  try {
    const raw = localStorage.getItem(KEYS.FEED);
    return raw ? JSON.parse(raw) : getDefaultFeed();
  } catch { return getDefaultFeed(); }
}

export function saveFeed(feed) {
  localStorage.setItem(KEYS.FEED, JSON.stringify(feed));
}

function getWeekLabel() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  return `Week of ${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function getDefaultFeed() {
  return [
    {
      id: "seed1",
      initials: "AK",
      name: "Arjun",
      message: "🔥 Arjun just hit a 4-workout week — new personal best. Gym rat era unlocked.",
      time: "2h ago",
      reactions: { "🔥": ["Maya", "Jin"], "💪": ["Sarah"] },
      replies: [
        { name: "Maya", text: "bro you're insane 😭" },
        { name: "Jin", text: "teach me your ways" },
      ],
    },
    {
      id: "seed2",
      initials: "SC",
      name: "Sarah",
      message: "👨‍🍳 Sarah cooked every single meal this week. Zero restaurants. Absolutely unhinged.",
      time: "5h ago",
      reactions: { "👑": ["Arjun", "Jin"], "😱": ["Maya"] },
      replies: [{ name: "Jin", text: "okay what's the recipe 👀" }],
    },
    {
      id: "seed3",
      initials: "MR",
      name: "Maya",
      message: "💀 Maya just hit a new eat-out record — 4 times and it's only Wednesday.",
      time: "Yesterday",
      reactions: { "💀": ["Jin"], "😂": ["Arjun", "Sarah"] },
      replies: [
        { name: "Sarah", text: "we've all been there lol" },
        { name: "Arjun", text: "DoorDash stock is up because of you" },
      ],
    },
  ];
}
