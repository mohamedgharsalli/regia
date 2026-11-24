# Requirements — REGIA (AI Parliament Simulator)

## Introduction
REGIA is a virtual parliament: AI deputies representing 5 Tunisian regions debate a proposed law and vote on it, so users can test laws before applying them in reality. Demo country: Tunisia. Category: Frankenstein (Kiroween 2026). Solo build, React + Vite on Vercel, demo video < 3 min.

## Glossary
- **Deputy:** one AI parliament member representing a region (Tunis, Sidi Bouzid, Gafsa, Sfax, Kasserine).
- **Indicator:** a deputy's numeric state, 0–100: Economy/Employment, Resources/Infrastructure, Cohesion/Support.
- **Net score:** a deputy's computed result for a law (weighted indicator changes). The vote follows the net score, never the LLM's mood.
- **Amendment Effect:** after the first vote, an amendment rescues the losing region, then a second vote compares both futures.

## Requirements

### Requirement 1 — Deputies and dashboard
**User Story:** As a user, I want to see the 5 deputies with their region, key issues, and 3 indicators, so I understand who decides.

#### Acceptance Criteria
1. WHEN the app loads, THE SYSTEM SHALL display 5 deputy cards: Tunis, Sidi Bouzid, Gafsa, Sfax, Kasserine.
2. WHEN a deputy card is shown, THE SYSTEM SHALL show its region, key issues, and 3 indicators (0–100).
3. WHEN the app loads, THE SYSTEM SHALL show national Stability and Happiness gauges computed from the deputies.

### Requirement 2 — Regional news and global context
**User Story:** As a user, I want each deputy to react to real news from their region, so the simulation is grounded in reality.

#### Acceptance Criteria
1. WHEN the user opens the app, THE SYSTEM SHALL fetch recent headlines via a serverless function (Google News RSS, queried by region keyword).
2. WHEN the news feed fails, THE SYSTEM SHALL fall back to preloaded cached headlines so the demo never breaks.
3. WHEN a headline is applied, THE SYSTEM SHALL show its source link next to the indicator change it caused.
4. WHEN a news impact is shown, THE SYSTEM SHALL display at most 3 structured impacts per refresh.

### Requirement 3 — Propose a law
**User Story:** As a user, I want to propose a law (preset or my own text), so I can test a decision.

#### Acceptance Criteria
1. WHEN the user opens the law panel, THE SYSTEM SHALL offer preset laws (minimum wage +20%, business tax −15%, water subsidy for farmers, infrastructure investment in interior regions).
2. WHEN the user types a custom law, THE SYSTEM SHALL accept it as free text and treat it like a preset law.
3. WHEN a law is submitted, THE SYSTEM SHALL compute its effects with the deterministic engine (never with LLM guesses).

### Requirement 4 — Debate and vote
**User Story:** As a user, I want each deputy to debate the law and vote, so I see who wins and who loses.

#### Acceptance Criteria
1. WHEN a law is submitted, THE SYSTEM SHALL produce 1–2 lines of reasoning per deputy, grounded in its dossier fact and the computed numbers.
2. WHEN a deputy votes, THE SYSTEM SHALL decide the vote from the deterministic net score: net > +2 APPROVE, net < −2 REJECT, otherwise ABSTAIN.
3. WHEN the vote is shown, THE SYSTEM SHALL display each deputy's vote next to its net score and the dossier fact behind it.
4. WHEN a law debate runs, THE SYSTEM SHALL use exactly one batched LLM call for all 5 deputies.

### Requirement 5 — Amendment Effect (two votes, two futures)
**User Story:** As a user, I want to see an amendment rescue the losing region and a second vote, so I compare both futures.

#### Acceptance Criteria
1. WHEN the first vote ends, THE SYSTEM SHALL identify the losing region(s) (net < −2).
2. WHEN a losing region exists, THE SYSTEM SHALL propose an amendment targeting it (e.g. temporary support for small businesses).
3. WHEN the amendment is applied, THE SYSTEM SHALL run a second vote and show both futures side by side: votes, winners/losers, Stability before/after.

### Requirement 6 — Honesty and safety
**User Story:** As a user, I want to know the results are simulated, so I never mistake them for real forecasts.

#### Acceptance Criteria
1. WHEN any result screen is shown, THE SYSTEM SHALL display "Simulated scenario — not a real economic forecast".
2. WHEN the app calls the LLM or news APIs, THE SYSTEM SHALL keep all API keys in Vercel serverless functions, never in the frontend.
3. WHEN the app is presented, THE SYSTEM SHALL describe itself as a simplified experimental parliament, not a real parliament.
