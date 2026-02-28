import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { log, archetype, balanceScore, compatibilities, userName } = req.body;

  const fallback = `Today, ${userName || "you"} showed up. Not perfect — but consistent. ${archetype?.emoji || ""} The best habits are built in moments like this one.`;

  // sanitize in case env is misformatted (quotes/extra spaces)
  const apiKey = process.env.OPENAI_API_KEY?.trim().replace(/(^\"|\"$)/g, "");
  if (!apiKey) {
    return res.json({ narrative: fallback });
  }

  const prompt = `Write a Spotify Wrapped-style personal narrative for ${userName}'s daily habit data.

Stats:
- Sugar meals: ${log.sugar}/7 days
- Ate out: ${log.ateOut}x
- Junk food: ${log.junk}x
- Workouts: ${log.workouts}
- Sleep avg: ${log.sleep}h
- Archetype: ${archetype.label} ${archetype.emoji}
- Balance Score: ${balanceScore}/100
- Best friend match: ${compatibilities[0]?.name} at ${compatibilities[0]?.score}%

Write 2-3 short punchy sentences. Be clever, slightly poetic, not preachy. No bullet points. Max 55 words. Sound like a Wrapped card, not a health report.`;

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100,
      temperature: 0.85,
    });
    res.json({ narrative: response.choices[0].message.content.trim() });
  } catch (err) {
    console.error("OpenAI error:", err.message);
    res.json({ narrative: fallback });
  }
}
