// ─── LIFESTYLE EMBEDDING & ML ────────────────────────────────────────────────

export function getEmbedding(log) {
  return [
    1 - Math.min((log.sugar || 0) / 7, 1),
    1 - Math.min((log.ateOut || 0) / 7, 1),
    1 - Math.min((log.junk || 0) / 7, 1),
    Math.min((log.workouts || 0) / 5, 1),
    Math.min((log.sleep || 7) / 9, 1),
  ];
}

export function cosineSimilarity(a, b) {
  const dot = a.reduce((s, ai, i) => s + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, ai) => s + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((s, bi) => s + bi * bi, 0));
  if (!magA || !magB) return 0;
  return Math.max(0, dot / (magA * magB));
}

export function getBalanceScore(log) {
  const [noSugar, noAteOut, noJunk, workouts, sleep] = getEmbedding(log);
  const weighted =
    noSugar * 0.15 +
    noAteOut * 0.2 +
    noJunk * 0.2 +
    workouts * 0.3 +
    sleep * 0.15;
  return Math.round(weighted * 100);
}

export function getArchetype(log) {
  const [noSugar, noAteOut, noJunk, workouts, sleep] = getEmbedding(log);
  const bad = ((1 - noSugar) + (1 - noAteOut) + (1 - noJunk)) / 3;
  const good = (workouts + sleep) / 2;

  if (good > 0.75 && bad < 0.25)
    return { label: "The Disciplined Builder", emoji: "🏗️", color: "#c8f04a", desc: "Consistent. Rested. Moving. You're operating at peak capacity." };
  if (bad > 0.65 && good < 0.35)
    return { label: "The Weekend Binger", emoji: "🌪️", color: "#ff5252", desc: "Chaos is your cardio. But self-awareness is step one." };
  if (workouts > 0.7 && bad > 0.4)
    return { label: "The Social Snacker", emoji: "🍕", color: "#ff8c42", desc: "Gym in the morning, pizza at night. Chaotic balance." };
  if (sleep < 0.4 && workouts > 0.5)
    return { label: "The Sleep-Deprived Achiever", emoji: "☕", color: "#a78bfa", desc: "Grinding hard but running on fumes. Sleep is your unlock." };
  if (noAteOut > 0.75 && noJunk > 0.75)
    return { label: "The Home Chef", emoji: "🍳", color: "#34d399", desc: "You cook, you plan, you execute. Your gut is grateful." };
  if (good > 0.5 && bad < 0.5)
    return { label: "The Balanced Builder", emoji: "⚖️", color: "#60a5fa", desc: "Finding your rhythm. The foundation is solid." };
  return { label: "The Work in Progress", emoji: "🌱", color: "#fbbf24", desc: "Every great habit story starts somewhere. This is yours." };
}

export function getTrends(currentLog, history) {
  if (!history.length) return [];
  const prev = history[0];
  const trends = [];
  if (currentLog.workouts > (prev.workouts || 0))
    trends.push({ good: true, text: `+${currentLog.workouts - prev.workouts} more workouts than last week` });
  else if (currentLog.workouts < (prev.workouts || 0))
    trends.push({ good: false, text: `${(prev.workouts||0) - currentLog.workouts} fewer workouts than last week` });
  if (currentLog.ateOut < (prev.ateOut || 0))
    trends.push({ good: true, text: `Ate out ${(prev.ateOut||0) - currentLog.ateOut}x less than last week` });
  else if (currentLog.ateOut > (prev.ateOut || 0))
    trends.push({ good: false, text: `Ate out ${currentLog.ateOut - (prev.ateOut||0)}x more than last week` });
  if (currentLog.sleep >= 8 && (prev.sleep || 0) < 8)
    trends.push({ good: true, text: "First week hitting 8h sleep 🌙" });
  if (currentLog.junk === 0 && (prev.junk || 0) > 0)
    trends.push({ good: true, text: "Zero junk this week — first time!" });
  return trends;
}

export function generateShoutout(userName, currentLog, history) {
  const shoutouts = [];
  const avgOf = (key) => history.length
    ? history.reduce((s, h) => s + (h[key] || 0), 0) / history.length
    : { sugar: 3, ateOut: 3, junk: 2, workouts: 2, sleep: 6.5 }[key] ?? 2;
  const prevBest = (key) => history.length ? Math.max(...history.map(h => h[key] || 0)) : 0;

  const avg = { workouts: avgOf("workouts"), ateOut: avgOf("ateOut"), junk: avgOf("junk"), sugar: avgOf("sugar") };

  if (currentLog.workouts > prevBest("workouts") && currentLog.workouts >= 4)
    shoutouts.push(`🔥 ${userName} just hit their most active week ever — ${currentLog.workouts} workouts logged. Beast mode confirmed.`);
  else if (currentLog.workouts >= avg.workouts * 1.5 && currentLog.workouts >= 3)
    shoutouts.push(`💪 ${userName} is on a workout tear — ${currentLog.workouts} sessions this week.`);

  if (currentLog.ateOut === 0)
    shoutouts.push(`👨‍🍳 ${userName} cooked every single meal this week. Zero restaurants. Absolutely unhinged discipline.`);
  else if (currentLog.ateOut > prevBest("ateOut") && currentLog.ateOut >= 5)
    shoutouts.push(`💸 ${userName} just set a new eat-out record — ${currentLog.ateOut} times this week 💀`);

  if (currentLog.junk === 0 && avg.junk > 1)
    shoutouts.push(`🥗 ${userName} went completely junk-free this week. Coming off an avg of ${Math.round(avg.junk)} junk meals — that's a glow up.`);

  if (currentLog.sugar === 0)
    shoutouts.push(`🍃 ${userName} had zero sugar meals this week. The discipline is genuinely alarming.`);

  if (currentLog.sleep >= 8 && avg.workouts >= 3)
    shoutouts.push(`⚡ ${userName} is sleeping 8h AND working out ${currentLog.workouts}x this week. They've cracked the code.`);

  if (!shoutouts.length)
    shoutouts.push(`✅ ${userName} logged their week. Balance score: ${getBalanceScore(currentLog)}/100. Showing up matters.`);

  return shoutouts[Math.floor(Math.random() * shoutouts.length)];
}

export const SEED_FRIENDS = [
  { id: "arjun", name: "Arjun", initials: "AK", log: { sugar: 2, ateOut: 1, junk: 1, workouts: 4, sleep: 7.5 }, history: [{ sugar: 3, ateOut: 2, junk: 2, workouts: 3, sleep: 7 }] },
  { id: "maya", name: "Maya", initials: "MR", log: { sugar: 5, ateOut: 4, junk: 3, workouts: 1, sleep: 5.5 }, history: [{ sugar: 4, ateOut: 3, junk: 2, workouts: 2, sleep: 6 }] },
  { id: "sarah", name: "Sarah", initials: "SC", log: { sugar: 1, ateOut: 2, junk: 0, workouts: 5, sleep: 8 }, history: [{ sugar: 2, ateOut: 2, junk: 1, workouts: 4, sleep: 7.5 }] },
  { id: "jin", name: "Jin", initials: "JP", log: { sugar: 3, ateOut: 3, junk: 2, workouts: 3, sleep: 6.5 }, history: [{ sugar: 3, ateOut: 4, junk: 3, workouts: 2, sleep: 6 }] },
];

export const CIRCLE_NAME = "Berkeley House 🏠";
