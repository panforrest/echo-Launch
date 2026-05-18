import { jsonChat, readJson, sendJson } from "./_openai.js";

export const config = { runtime: "nodejs" };
export const maxDuration = 60;

const SYSTEM = `You are EchoLaunch, an elite launch-marketing copilot rewriting copy to address specific objections from an Audience Twin.

You will receive: the target channel, the current copy, the twin persona, the previous objections, the previous strongest hook, and the previous weakest line.

Rewrite the copy so that:
- The weak line is replaced or strengthened (don't reuse it verbatim).
- Each objection is meaningfully addressed (e.g., add concrete numbers, a named customer, a sharper claim, a specific scenario).
- The strong hook is preserved or improved (don't lose what was working).
- Style stays platform-native and cliché-free.

CRITICAL — the "copy" field shape MUST be:
- For channel "linkedin": a plain STRING (the full post text). NOT an object.
- For channel "x": a JSON ARRAY of EXACTLY 5 strings (the tweets). NOT a string, NOT an object.
- For channel "product_hunt": a JSON OBJECT with exactly the keys "tagline" (string) and "description" (string).
- For channel "landing": a JSON OBJECT with exactly the keys "headline" (string), "subheadline" (string), "cta" (string).

Then re-score the rewritten copy from the twin's perspective. The new overall score should be HIGHER than the previous one, but stay honest — most rewrites land 78-92.

Quote strongest_hook and weakest_line VERBATIM from the REWRITTEN copy.

Respond with a single JSON object, no markdown.`;

const SCHEMA = `{
  "copy": "<same shape as input copy for this channel>",
  "reaction": {
    "channel": "<same channel>",
    "scores": { "clarity": 0-100, "relevance": 0-100, "curiosity": 0-100, "trust": 0-100, "engagement": 0-100, "overall": 0-100 },
    "objections": ["0-2 remaining nitpicks, in-character"],
    "strongest_hook": "VERBATIM line from rewritten copy",
    "weakest_line": "VERBATIM line from rewritten copy"
  }
}`;

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const body = await readJson(req);
    const channel = String(body.channel || "").trim();
    if (!["linkedin", "x", "product_hunt", "landing"].includes(channel)) {
      return sendJson(res, 400, { error: "Invalid channel" });
    }

    const userMessage = [
      `Channel: ${channel}`,
      ``,
      `Audience Twin:\n${JSON.stringify(body.twin || {}, null, 2)}`,
      ``,
      `Current copy:\n${JSON.stringify(body.currentCopy, null, 2)}`,
      ``,
      `Previous objections (must address):\n- ${(body.objections || []).join("\n- ") || "(none)"}`,
      ``,
      `Previous strongest hook (preserve or improve):\n"${body.strongest_hook || ""}"`,
      ``,
      `Previous weakest line (must fix):\n"${body.weakest_line || ""}"`,
      ``,
      `Previous overall score: ${body.previous_overall ?? "n/a"}`,
      ``,
      `Original product context — URL: ${body.product?.url || "(n/a)"}, Description: ${body.product?.description || "(n/a)"}`,
      ``,
      `Rewrite now. Return JSON only.`,
    ].join("\n");

    const data = await jsonChat({
      system: SYSTEM,
      user: userMessage,
      schemaHint: SCHEMA,
      temperature: 0.85,
    });

    const normalized = normalize(channel, data);
    return sendJson(res, 200, normalized);
  } catch (err) {
    console.error("/api/rewrite error:", err);
    return sendJson(res, 500, { error: err?.message || "Rewrite failed" });
  }
}

function clamp(n, lo, hi) {
  const x = Number.isFinite(+n) ? +n : 0;
  return Math.max(lo, Math.min(hi, Math.round(x)));
}

function normalize(channel, data) {
  const r = data?.reaction || {};
  const s = r.scores || {};
  const scores = {
    clarity: clamp(s.clarity, 0, 100),
    relevance: clamp(s.relevance, 0, 100),
    curiosity: clamp(s.curiosity, 0, 100),
    trust: clamp(s.trust, 0, 100),
    engagement: clamp(s.engagement, 0, 100),
  };
  const overall = clamp(
    s.overall ?? Math.round((scores.clarity + scores.relevance + scores.curiosity + scores.trust + scores.engagement) / 5),
    0,
    100,
  );
  const reaction = {
    channel,
    scores: { ...scores, overall },
    objections: Array.isArray(r.objections) ? r.objections.slice(0, 3).map(String) : [],
    strongest_hook: String(r.strongest_hook || ""),
    weakest_line: String(r.weakest_line || ""),
  };
  const raw = data?.copy;
  let copy;
  if (channel === "linkedin") {
    copy = unwrapString(raw, ["post", "text", "content", "copy", "linkedin"]);
  } else if (channel === "x") {
    let arr = raw;
    if (!Array.isArray(arr)) {
      if (Array.isArray(raw?.tweets)) arr = raw.tweets;
      else if (Array.isArray(raw?.thread)) arr = raw.thread;
      else if (Array.isArray(raw?.x_thread)) arr = raw.x_thread;
      else if (typeof raw === "string") arr = raw.split(/\n\s*\n+/).map((s) => s.trim()).filter(Boolean);
      else arr = [];
    }
    copy = arr.map((t) => unwrapString(t, ["text", "tweet"]));
  } else if (channel === "product_hunt") {
    copy = {
      tagline: unwrapString(raw?.tagline, ["text"]),
      description: unwrapString(raw?.description, ["text"]),
    };
  } else if (channel === "landing") {
    copy = {
      headline: unwrapString(raw?.headline, ["text"]),
      subheadline: unwrapString(raw?.subheadline, ["text"]),
      cta: unwrapString(raw?.cta, ["text"]) || "Get Started",
    };
  }
  return { copy, reaction };
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
