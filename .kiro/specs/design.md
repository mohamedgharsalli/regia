# Design — REGIA (AI Parliament Simulator)

## Overview
REGIA is a React + Vite single-page app deployed on Vercel. A deterministic JavaScript simulation engine computes all numbers (indicator changes, votes, stability). An LLM is used only to write each deputy's 1–2 lines of reasoning, in one batched call per law. News comes from Google News RSS through a Vercel serverless function, with cached headlines as fallback.

## Architecture
```
Browser (React + Vite)
  ├── components/      DeputyCard, LawProposal, DebateLog, VoteResults, Comparison, Dashboard
  ├── lib/engine.js    deterministic simulation engine (rules, voting, amendment)
  ├── data/deputies.js 5 deputies: dossier facts, starting indicators, sensitivities
  └── data/news-fallback.js cached headlines
Vercel serverless functions (API keys live ONLY here)
  ├── /api/news    fetches Google News RSS by region keyword, returns JSON
  └── /api/debate  one batched Gemini call (Flash-Lite) → structured JSON for all 5 deputies
```

## Components
- **DeputyCard:** region, key issues, 3 indicators (bars 0–100), current stance.
- **LawProposal:** preset law buttons + free-text input + submit.
- **DebateLog:** each deputy's 1–2 reasoning lines with its cited dossier fact / news source.
- **VoteResults:** vote counts, each deputy's vote + net score.
- **Comparison:** first vote vs second (amended) vote side by side; winners/losers; Stability before/after.
- **Dashboard:** Stability + Happiness gauges, impact per region, sources list, "Simulated scenario" label.

## Data Models
```ts
type Indicator = { economy: number; resources: number; cohesion: number };
type Deputy = {
  id: string; region: string; title: string;
  issues: string[]; facts: { text: string; source: string }[];
  indicators: Indicator;
  sensitivity: { labour: number; water: number; investment: number; tax: number };
};
type Law = { id: string; title: string; effects: { indicator: keyof Indicator; delta: number; sensitivity: string }[] };
type Vote = { deputyId: string; choice: 'APPROVE' | 'REJECT' | 'ABSTAIN'; netScore: number; reasoning: string };
type NewsImpact = { indicator: keyof Indicator; region: string; delta: number; headline: string; source: string };
```

## Engine rules (summary — full rules in regia-engine-rules.md)
- Net score = 2×Δeconomy + 1×Δresources + 1.5×Δcohesion, after per-region sensitivity multipliers.
- Vote: net > +2 APPROVE, net < −2 REJECT, else ABSTAIN.
- Stability = average Cohesion; Happiness = average Economy.
- Amendment: applied to losing region(s), then a second vote; both futures compared.

## LLM usage (budget)
- Model: Gemini Flash-Lite (free tier 500 req/day; Flash is only 20/day — do not use Flash).
- Exactly one call per law debate (all 5 deputies in one structured-JSON response) and one per news refresh.
- Prompts include the deputy's dossier facts + computed numbers; the LLM must not invent numbers.

## News
- Primary: Google News RSS via `/api/news` (no key, no quota), queried by region keyword (e.g. "Sidi Bouzid", "Gafsa").
- Backup: GNews (100 req/day). Fallback: `data/news-fallback.js` cached headlines.
- NewsAPI.org is NOT used (free tier breaks when deployed: CORS localhost-only, dev-only).

## Testing
- Engine unit checks: min-wage +20% must produce first vote 3 APPROVE / 1 REJECT / 1 ABSTAIN (Tunis approve, Sidi Bouzid abstain, Gafsa approve, Sfax reject, Kasserine approve).
- Demo resilience: with network blocked, the app still runs fully on cached news.
- One complete working scenario (Tunisia, min-wage law, amendment, comparison) is the priority; extra countries/laws are secondary.
