# EchoLaunch

**Generate your launch. Simulate your audience. Ship what lands.**

EchoLaunch creates platform-specific marketing copy (LinkedIn, X, Product Hunt, Landing page) and tests it against a simulated audience persona — so you ship messaging that resonates, not guesses.

## Pages

- `/` — Marketing landing page
- `/dashboard` — Launch Command Center (3-panel app)
  - **Left**: Product input form (URL + description)
  - **Center**: Tabbed copy previews with score bar, Rewrite, and Export All buttons
  - **Right**: Audience Twin persona card + reactions feed

## Local preview

This is a static site. Serve the folder with any web server:

```bash
# option 1 — python (no install needed)
python3 -m http.server 5173

# option 2 — npx
npx serve -l 5173
```

Open http://localhost:5173 in your browser.

## Deploy

This project is configured for Vercel. From this directory:

```bash
npx vercel login
npx vercel        # preview deploy
npx vercel --prod # production deploy
```

## Stack

- Pure static HTML
- Tailwind CSS (via CDN)
- Vanilla JavaScript
- Mock data for the audience twin & reactions (frontend-only MVP)
