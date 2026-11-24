# REGIA — AI Parliament Simulator

> **Simplified experimental parliament simulator — not a real parliament.**
> All results are simulated scenarios, not real economic forecasts.

REGIA lets you propose a law, watch five AI deputies representing Tunisian regions debate and vote on it, then apply an amendment to rescue the losing region and compare both futures side by side.

Built for the **Kiroween 2026** hackathon (Frankenstein category). Solo project.

---

## Demo

Live URL: _set after Vercel deploy (task 8.1)_

Demo video: _set after recording (task 8.2)_

---

## How it works

```
Browser (React + Vite)
  ├── components/     DeputyCard, Dashboard, NewsPanel, DebateLog,
  │                   VoteResults, AmendmentProposal, Comparison
  ├── hooks/          useNews, useDebate
  ├── lib/engine.js   deterministic simulation (pure JS, no LLM)
  └── data/           deputies.js, laws.js, news-fallback.js

Vercel serverless functions
  ├── /api/news       Google News RSS → NewsImpact[] (no API key)
  └── /api/debate     Gemini 2.0 Flash-Lite → spoken reasoning (1 call/law)
```

### Vote rule (deterministic — LLM cannot change it)
```
net score = 2×ΔEconomy + 1×ΔResources + 1.5×ΔCohesion
net > +2  → APPROVE
net < −2  → REJECT
otherwise → ABSTAIN
```

### Amendment rule
After the first vote the engine identifies the deputy with the lowest net score,
adds a targeted effect on their weakest indicator via their strongest sensitivity
lever, and re-runs the full simulation.

---

## Deputies (Tunisia)

| Region | Title | Key issues |
|---|---|---|
| Tunis | The Capital | Transport, cost of living, public services |
| Sidi Bouzid | The Farmer | Agriculture, water, irrigation |
| Gafsa | The Miner | Phosphate employment, pollution |
| Sfax | The Industrial Port | Industry, environment, exports |
| Kasserine | The Interior | Infrastructure, regional development |

---

## Stack

- **React 19 + TypeScript** — UI
- **Vite 8** — build tooling
- **Recharts** — Stability/Happiness gauges
- **Vercel** — hosting + serverless functions
- **Gemini 2.0 Flash-Lite** — debate reasoning (one batched call per law)
- **Google News RSS** — regional headlines (no API key)

---

## Local development

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev
```

> The `/api/news` and `/api/debate` serverless functions require the
> [Vercel CLI](https://vercel.com/docs/cli) to run locally:
> ```bash
> npx vercel dev
> ```
> Set `GEMINI_API_KEY` in `.env.local` (never commit it):
> ```
> GEMINI_API_KEY=your_key_here
> ```
> Without the key the debate function falls back to template reasoning automatically.

---

## Deploy to Vercel

```bash
npx vercel --prod
```

Then set the `GEMINI_API_KEY` environment variable in the
[Vercel dashboard](https://vercel.com/dashboard) under
**Settings → Environment Variables** for the `regia` project.

---

## Project structure

```
regia/
├── api/
│   ├── news.js          # Serverless: Google News RSS → NewsImpact[]
│   └── debate.js        # Serverless: Gemini Flash-Lite reasoning
├── src/
│   ├── components/
│   │   ├── AmendmentProposal.tsx
│   │   ├── Comparison.tsx
│   │   ├── Dashboard.tsx
│   │   ├── DebateLog.tsx
│   │   ├── DeputyCard.tsx
│   │   ├── NewsPanel.tsx
│   │   └── VoteResults.tsx
│   ├── data/
│   │   ├── deputies.js       # 5 deputies: indicators, sensitivities, facts
│   │   ├── laws.js           # 4 preset laws with effects
│   │   └── news-fallback.js  # Cached headlines (demo resilience)
│   ├── hooks/
│   │   ├── useDebate.ts      # Both vote rounds + amendment cycle
│   │   └── useNews.ts        # Fetch + apply regional news impacts
│   └── lib/
│       └── engine.js         # Deterministic simulation engine
├── vercel.json
├── LICENSE                   # MIT
└── README.md
```

---

## Honesty & safety

- Every result screen displays **"Simulated scenario — not a real economic forecast"**.
- The app describes itself as a **simplified experimental parliament**, not a real one.
- All API keys live exclusively in Vercel serverless functions — never in the frontend bundle.
- Vote outcomes are computed by the deterministic engine. The LLM writes only the spoken
  reasoning text and cannot change any number or vote.

---

## License

MIT — see [LICENSE](./LICENSE).
