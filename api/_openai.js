import OpenAI from "openai";

export const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey });
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.length) {
    try { return JSON.parse(req.body); } catch { /* ignore */ }
  }
  return await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export async function jsonChat({ system, user, schemaHint, temperature = 0.85, maxTokens = 4000 }) {
  const client = getClient();
  const resp = await client.chat.completions.create({
    model: MODEL,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system + (schemaHint ? "\n\nReturn ONLY valid JSON matching this schema (no prose, no markdown fences):\n" + schemaHint : "") },
      { role: "user", content: user },
    ],
  });
  const content = resp.choices?.[0]?.message?.content || "{}";
  return JSON.parse(content);
}
