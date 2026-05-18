# EchoLaunch

**Generate your launch. Simulate your audience. Ship what lands.**

EchoLaunch creates platform-specific marketing copy (LinkedIn, X, Product Hunt, Landing page) and tests it against a simulated audience persona — so you ship messaging that resonates, not guesses.

> **Live:** <https://echolaunch.vercel.app>

## Hackathon

This project was built at the [**Beats & Build Hackathon (NYC) by Second Axis**](https://luma.com/u1wbvyg7), hosted by PMs in AI.

**Team:** Forrest Pan, Frank Yu, Jin Thakur

**Award:** Founder's Choice

## Pages

- `/` — Marketing landing page
- `/dashboard` — Launch Command Center (3-panel app)
  - **Left**: Product input form (URL + description)
  - **Center**: Tabbed copy previews with score bar, Rewrite, and Export All buttons
  - **Right**: Audience Twin persona card + reactions feed

## How it works

1. Describe your product (a URL, a paragraph, or both).
2. EchoLaunch calls `gpt-4o-mini` to build an **Audience Twin** — a specific ICP persona — and to generate platform-native copy for all four channels.
3. The twin then "reacts" to each piece of copy: scoring it on clarity, relevance, curiosity, trust, and engagement, and surfacing the strongest hook line and the weakest line verbatim.
4. Click **Rewrite** on any tab to address the twin's objections and improve the score. Click **Export All** to download the full kit as JSON.

## Local preview

```bash
# 1. install dependencies
npm install

# 2. set your OpenAI key (or pull it from Vercel)
echo 'OPENAI_API_KEY="sk-..."' > .env.local
# or, if the project is linked to Vercel:
# npx vercel env pull .env.local

# 3. run the local dev server (includes the /api routes)
npx vercel dev --listen 5173
```

Open <http://localhost:5173> in your browser.

## Deploy

This project is configured for Vercel. From this directory:

```bash
npx vercel login
npx vercel --prod
```

Make sure `OPENAI_API_KEY` is set on the Vercel project before deploying:

```bash
npx vercel env add OPENAI_API_KEY production
```

## Stack

- Vanilla HTML + [Tailwind CSS](https://tailwindcss.com/) (via CDN)
- Vanilla JavaScript on the frontend
- [Vercel Functions](https://vercel.com/docs/functions) (Node.js) for the API routes
- [OpenAI](https://platform.openai.com/) `gpt-4o-mini` for generation and rewrites

### API routes

- `POST /api/generate` — input `{ url?, description? }`, returns `{ twin, copies, reactions }`
- `POST /api/rewrite` — input `{ channel, currentCopy, objections, strongest_hook, weakest_line, previous_overall, twin, product }`, returns `{ copy, reaction }`

The `OPENAI_API_KEY` is read **server-side only** and is never shipped to the browser.
