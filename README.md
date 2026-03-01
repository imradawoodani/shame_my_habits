# HabitWrapped 🎧
> Spotify Wrapped for your lifestyle habits — with lifestyle embeddings, archetypes, and a social circle feed.

## Setup (5 minutes)

```bash
# 1. Install
npm install

# 2. Add your OpenAI key (create .env.local)
echo "OPENAI_API_KEY=sk-..." > .env.local

# 3. Run
npm run dev
```

Open http://localhost:3000

## What's built

**Tab 1 — My Hub**
- Log 5 habit metrics via tap counters
- Live balance score + archetype
- "Log to Circle" triggers auto-shoutout

**Tab 2 — My Circle**
- Friend circle feed with auto-generated shoutouts
- Leaderboard (collapsible)
- Reply to friend posts

**Tab 3 — Wrapped**
- Full slide reveal experience
- Balance score, archetype, friend compatibility %
- AI-generated narrative (OpenAI)

## The ML (in lib/ml.js)

1. `getEmbedding(log)` — 5D lifestyle vector, normalized
2. `cosineSimilarity(a, b)` — friend compatibility %
3. `getArchetype(log)` — behavioral clustering via rules
4. `getBalanceScore(log)` — leaderboard score 0-100
5. `generateShoutout(name, log, history)` — detects personal bests/worsts

## Customize

**Change friend names/data:** edit `SEED_FRIENDS` in `lib/ml.js`
**Change circle name:** edit `CIRCLE_NAME` in `lib/ml.js`
**Add more archetypes:** add cases in `getArchetype()`
**Add more shoutout triggers:** add `if` blocks in `generateShoutout()`
