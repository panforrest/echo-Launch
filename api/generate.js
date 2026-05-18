import { jsonChat, readJson, sendJson } from "./_openai.js";

export const config = { runtime: "nodejs" };
export const maxDuration = 60;

const SCHEMA = `{
  "twin": {
    "name": "string (realistic full name)",
    "role": "string (specific role + company stage/type, e.g. 'VP of Marketing at Series B SaaS')",
    "industry": "string",
    "experience_years": "integer 3-25",
    "pain_points": ["3 specific pain points"],
    "goals": ["2-3 concrete goals"],
    "skepticism_level": "integer 1-10",
    "communication_style": "short phrase",
    "what_convinces_them": "short sentence",
    "what_turns_them_off": "short sentence"
  },
  "copies": {
    "linkedin": "string — a single LinkedIn post (150-220 words) written in first-person, with a strong hook in line 1, short paragraphs, and a single thought-provoking question at the end",
    "x_thread": ["array of EXACTLY 5 tweets, each <= 270 chars, no leading numbering"],
    "product_hunt": {
      "tagline": "string <= 60 chars",
      "description": "string 50-120 words"
    },
    "landing": {
      "headline": "string <= 60 chars",
      "subheadline": "string <= 130 chars",
      "cta": "string 2-4 words"
    }
  },
  "reactions": [
    {
      "channel": "linkedin",
      "scores": { "clarity": 0-100, "relevance": 0-100, "curiosity": 0-100, "trust": 0-100, "engagement": 0-100, "overall": 0-100 },
      "objections": ["1-3 specific, in-character objections from the twin"],
      "strongest_hook": "VERBATIM line from the copy that lands best",
      "weakest_line": "VERBATIM line from the copy that lands worst"
    },
    { "channel": "x", "...": "same shape; strongest_hook/weakest_line VERBATIM from the x_thread" },
    { "channel": "product_hunt", "...": "same shape; lines may come from tagline or description" },
    { "channel": "landing", "...": "same shape; lines may come from headline/subheadline/cta" }
  ]
}`;

const SYSTEM = `You are EchoLaunch, an elite launch-marketing copilot.

Given a product, you:
1) Build a realistic Audience Twin persona representing the product's ideal customer (ICP). Make them feel like a specific person, not a generic role.
2) Write platform-native launch copy for FOUR channels: LinkedIn (long-form first-person post), X (5-tweet thread), Product Hunt (tagline + description), Landing page (headline + subheadline + CTA).
3) Then put yourself fully in the Audience Twin's head and react to each piece of copy. Score honestly on a 0-100 scale (most copy lands 60-85; reserve 90+ for genuinely exceptional, sub-50 for poor). Provide 1-3 SPECIFIC, in-character objections. Quote verbatim the strongest hook line and the weakest line FROM THE COPY YOU JUST WROTE.

Style rules for the copy:
- Concrete > vague. Use specific numbers, scenarios, named tools, or trade-offs.
- Earn attention in the first line. No "in today's fast-paced world" openers.
- Avoid clichés: "game-changing", "revolutionary", "stop guessing start winning", "level up", "unlock your potential".
- Platform-native: LinkedIn = narrative + insight; X = punchy + thread mechanics; Product Hunt = benefit-led + scannable; Landing = clarity + verb-led CTA.
- Do not invent product features. Stay grounded in what the user described.

Your response MUST be a single JSON object only — no markdown, no commentary.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const body = await readJson(req);
    const url = (body.url || "").toString().trim();
    const description = (body.description || "").toString().trim();
    if (!url && !description) {
      return sendJson(res, 400, { error: "Provide a product URL, a description, or both." });
    }

    const userMessage = `Product URL: ${url || "(not provided)"}\n\nProduct Description:\n${description || "(not provided — infer from the URL)"}\n\nGenerate the launch kit now. Return JSON only.`;

    const data = await jsonChat({
      system: SYSTEM,
      user: userMessage,
      schemaHint: SCHEMA,
      temperature: 0.9,
    });

    const normalized = normalize(data);
    return sendJson(res, 200, normalized);
  } catch (err) {
    console.error("/api/generate error:", err);
    return sendJson(res, 500, { error: err?.message || "Generation failed" });
  }
}

function clamp(n, lo, hi) {
  const x = Number.isFinite(+n) ? +n : 0;
  return Math.max(lo, Math.min(hi, Math.round(x)));
}

function normalize(d) {
  const twin = d?.twin || {};
  const copies = d?.copies || {};
  const reactionsArr = Array.isArray(d?.reactions) ? d.reactions : [];

  const fixedTwin = {
    name: String(twin.name || "Sarah Chen"),
    role: String(twin.role || "VP of Marketing at Series B SaaS"),
    industry: String(twin.industry || "B2B SaaS"),
    experience_years: clamp(twin.experience_years || 10, 1, 50),
    pain_points: Array.isArray(twin.pain_points) ? twin.pain_points.slice(0, 5) : [],
    goals: Array.isArray(twin.goals) ? twin.goals.slice(0, 5) : [],
    skepticism_level: clamp(twin.skepticism_level || 6, 1, 10),
    communication_style: String(twin.communication_style || "Direct, data-driven"),
    what_convinces_them: String(twin.what_convinces_them || "Specific metrics and proof"),
    what_turns_them_off: String(twin.what_turns_them_off || "Vague buzzwords"),
  };

  let xThreadRaw = copies.x_thread;
  if (!Array.isArray(xThreadRaw)) {
    if (Array.isArray(xThreadRaw?.tweets)) xThreadRaw = xThreadRaw.tweets;
    else if (Array.isArray(xThreadRaw?.thread)) xThreadRaw = xThreadRaw.thread;
    else if (typeof xThreadRaw === "string") xThreadRaw = xThreadRaw.split(/\n\s*\n+/).map((s) => s.trim()).filter(Boolean);
    else xThreadRaw = [];
  }
  const fixedCopies = {
    linkedin: unwrapString(copies.linkedin, ["post", "text", "content"]),
    x_thread: xThreadRaw.map((t) => unwrapString(t, ["text", "tweet"])),
    product_hunt: {
      tagline: unwrapString(copies.product_hunt?.tagline, ["text"]),
      description: unwrapString(copies.product_hunt?.description, ["text"]),
    },
    landing: {
      headline: unwrapString(copies.landing?.headline, ["text"]),
      subheadline: unwrapString(copies.landing?.subheadline, ["text"]),
      cta: unwrapString(copies.landing?.cta, ["text"]) || "Get Started",
    },
  };

  const wantedChannels = ["linkedin", "x", "product_hunt", "landing"];
  const reactions = wantedChannels.map((ch) => {
    const r = reactionsArr.find((x) => x?.channel === ch) || {};
    const s = r.scores || {};
    const scores = {
      clarity: clamp(s.clarity, 0, 100),
      relevance: clamp(s.relevance, 0, 100),
      curiosity: clamp(s.curiosity, 0, 100),
      trust: clamp(s.trust, 0, 100),
      engagement: clamp(s.engagement, 0, 100),
    };
    const overall = clamp(
      s.overall ??
        Math.round((scores.clarity + scores.relevance + scores.curiosity + scores.trust + scores.engagement) / 5),
      0,
      100,
    );
    return {
      channel: ch,
      scores: { ...scores, overall },
      objections: Array.isArray(r.objections) ? r.objections.slice(0, 3).map(String) : [],
      strongest_hook: String(r.strongest_hook || ""),
      weakest_line: String(r.weakest_line || ""),
    };
  });

  return { twin: fixedTwin, copies: fixedCopies, reactions };
}

function unwrapString(v, keys = []) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    for (const k of keys) {
      if (typeof v[k] === "string") return v[k];
    }
    const firstStr = Object.values(v).find((x) => typeof x === "string");
    if (firstStr) return firstStr;
    return "";
  }
  return "";
}
