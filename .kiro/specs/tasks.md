# Tasks — REGIA (AI Parliament Simulator)

Build order for the sprint (started early: 23 Nov night). Check off each item as it is done and tested.

## 1. Scaffold
- [ ] 1.1 Create Vite + React + TypeScript app in `C:\REGIA` (`npm create vite@latest regia -- --template react-ts`)
- [x] 1.2 Install deps: `npm install` (+ recharts for gauges/charts)
- [ ] 1.3 Verify dev server runs: `npm run dev` → app opens in browser
- [ ] 1.4 Copy this spec into `C:\REGIA\.kiro\specs\regia\` (requirements.md, design.md, tasks.md)
- [ ] 1.5 Create public GitHub repo `regia` (public, MIT license) and push the scaffold

## 2. Data — deputies (from regia-deputies-tunisia.md)
- [x] 2.1 Create `src/data/deputies.js` with the 5 deputies: region, title, issues, facts + sources, starting indicators, sensitivities
- [x] 2.2 Create `src/data/laws.js` with 4 preset laws and their base effects
- [x] 2.3 Create `src/data/news-fallback.js` with cached headlines per region

## 3. Engine (from regia-engine-rules.md)
- [x] 3.1 Implement `src/lib/engine.js`: apply law effects with sensitivities, compute net scores
- [x] 3.2 Implement voting rule (net > +2 APPROVE, < −2 REJECT, else ABSTAIN)
- [x] 3.3 Implement Stability/Happiness gauges (averages)
- [x] 3.4 Implement amendment: find losing region, apply amendment effects, re-vote
- [x] 3.5 Test: min-wage +20% gives first vote 3 APPROVE / 1 REJECT / 1 ABSTAIN

## 4. UI shell
- [x] 4.1 App layout: header (REGIA + "simplified experimental parliament"), deputy row, law panel, results area
- [x] 4.2 DeputyCard component (region, issues, 3 indicator bars)
- [x] 4.3 Dashboard gauges (Stability, Happiness) + "Simulated scenario" label everywhere

## 5. News
- [x] 5.1 Create Vercel serverless function `api/news.js` (Google News RSS by region keyword)
- [x] 5.2 Apply up to 3 news impacts per refresh, each with source link
- [x] 5.3 Fallback to cached headlines when the feed fails

## 6. Debate and vote
- [x] 6.1 Create serverless function `api/debate.js` (Gemini Flash-Lite, one batched call, structured JSON)
- [x] 6.2 DebateLog component: 1–2 reasoning lines per deputy + cited fact/source
- [x] 6.3 VoteResults component: counts + each vote with net score

## 7. Amendment Effect
- [x] 7.1 Identify losing region after first vote, propose amendment
- [x] 7.2 Second vote + Comparison component (both futures side by side)

## 8. Deploy, video, submit
- [ ] 8.1 Deploy to Vercel, test the live URL end to end (with network, and with news blocked)
- [ ] 8.2 Record demo video < 3 min (Tunisia → news → min-wage law → vote → amendment → comparison)
- [ ] 8.3 Write Devpost submission: description + how Kiro was used (specs, steering, hooks)
- [ ] 8.4 Submit on Devpost before Fri 4 Dec 2026, 23:00 Tunis
