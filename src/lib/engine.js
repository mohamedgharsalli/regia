/**
 * REGIA — Deterministic simulation engine
 *
 * All functions are pure (no mutation of inputs). Numbers are computed
 * entirely in JavaScript; no LLM or network calls happen here.
 *
 * Net score formula:
 *   netScore = 2×Δeconomy + 1×Δresources + 1.5×Δcohesion
 *
 * Where each Δindicator is the sum over matching law effects:
 *   Δindicator = Σ (effect.delta × deputy.sensitivity[effect.sensitivity])
 *
 * Vote rule:
 *   net > +2  → 'APPROVE'
 *   net < −2  → 'REJECT'
 *   otherwise → 'ABSTAIN'
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sum all deltas for one indicator from a law's effects, scaled by sensitivity.
 * @param {object[]} effects - Law effects array
 * @param {string} indicator - 'economy' | 'resources' | 'cohesion'
 * @param {object} sensitivity - Deputy's sensitivity map
 * @returns {number}
 */
function sumDeltaForIndicator(effects, indicator, sensitivity) {
  return effects
    .filter((e) => e.indicator === indicator)
    .reduce((sum, e) => sum + e.delta * (sensitivity[e.sensitivity] ?? 1), 0);
}

/**
 * Determine vote from a net score.
 * @param {number} netScore
 * @returns {'APPROVE' | 'REJECT' | 'ABSTAIN'}
 */
export function getVote(netScore) {
  if (netScore > 2) return 'APPROVE';
  if (netScore < -2) return 'REJECT';
  return 'ABSTAIN';
}

// ---------------------------------------------------------------------------
// Core engine functions
// ---------------------------------------------------------------------------

/**
 * Compute one deputy's result for a given law.
 *
 * @param {object} deputy - Deputy object from deputies.js
 * @param {object} law    - Law object from laws.js
 * @returns {{ deputyId: string, netScore: number, deltaEconomy: number, deltaResources: number, deltaCohesion: number, vote: 'APPROVE'|'REJECT'|'ABSTAIN' }}
 */
export function computeDeputyResult(deputy, law) {
  const { effects } = law;
  const { sensitivity } = deputy;

  const deltaEconomy   = sumDeltaForIndicator(effects, 'economy',   sensitivity);
  const deltaResources = sumDeltaForIndicator(effects, 'resources', sensitivity);
  const deltaCohesion  = sumDeltaForIndicator(effects, 'cohesion',  sensitivity);

  const netScore = 2 * deltaEconomy + 1 * deltaResources + 1.5 * deltaCohesion;
  const vote     = getVote(netScore);

  return {
    deputyId: deputy.id,
    netScore,
    deltaEconomy,
    deltaResources,
    deltaCohesion,
    vote,
  };
}

/**
 * Run a law through the full chamber and return one result per deputy.
 *
 * @param {object[]} deputies - Full deputies array
 * @param {object}   law      - Law object from laws.js
 * @returns {ReturnType<typeof computeDeputyResult>[]}
 */
export function simulateLaw(deputies, law) {
  return deputies.map((deputy) => computeDeputyResult(deputy, law));
}

/**
 * Stability = average cohesion across all deputies.
 *
 * @param {object[]} deputies
 * @returns {number}
 */
export function computeStability(deputies) {
  if (!deputies.length) return 0;
  return deputies.reduce((sum, d) => sum + d.indicators.cohesion, 0) / deputies.length;
}

/**
 * Happiness = average economy across all deputies.
 *
 * @param {object[]} deputies
 * @returns {number}
 */
export function computeHappiness(deputies) {
  if (!deputies.length) return 0;
  return deputies.reduce((sum, d) => sum + d.indicators.economy, 0) / deputies.length;
}

/**
 * Convenience wrapper: returns both gauges in one object.
 *
 * @param {object[]} deputies
 * @returns {{ stability: number, happiness: number }}
 */
export function computeGauges(deputies) {
  return {
    stability: computeStability(deputies),
    happiness: computeHappiness(deputies),
  };
}

/**
 * Apply indicator deltas from simulation results to the deputies array.
 * Returns a NEW array; original deputies are NOT mutated.
 * All indicator values are clamped to [0, 100].
 *
 * @param {object[]} deputies - Original deputies array
 * @param {ReturnType<typeof computeDeputyResult>[]} results - Output of simulateLaw
 * @returns {object[]} Updated deputies array
 */
export function applyIndicatorDeltas(deputies, results) {
  const resultMap = new Map(results.map((r) => [r.deputyId, r]));

  return deputies.map((deputy) => {
    const result = resultMap.get(deputy.id);
    if (!result) return deputy;

    const clamp = (v) => Math.min(100, Math.max(0, v));

    return {
      ...deputy,
      indicators: {
        economy:   clamp(deputy.indicators.economy   + result.deltaEconomy),
        resources: clamp(deputy.indicators.resources + result.deltaResources),
        cohesion:  clamp(deputy.indicators.cohesion  + result.deltaCohesion),
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Amendment logic
// ---------------------------------------------------------------------------

/**
 * Find the deputy with the lowest net score (the most opposed region).
 * When several deputies tie on the minimum, the first in the array wins.
 *
 * @param {ReturnType<typeof computeDeputyResult>[]} results - Output of simulateLaw
 * @returns {string} deputyId of the losing region
 */
export function findLosingRegion(results) {
  if (!results.length) throw new Error('findLosingRegion: results array is empty');
  return results.reduce(
    (worst, r) => (r.netScore < worst.netScore ? r : worst),
    results[0]
  ).deputyId;
}

/**
 * Build an amended version of a law by adding extra effects that benefit the
 * losing region's weakest indicator.
 *
 * Strategy:
 *   1. Look at the losing deputy's current indicators.
 *   2. Identify the indicator with the lowest value.
 *   3. Add a targeted effect (delta +3) on that indicator, keyed to the
 *      sensitivity that the losing deputy cares about most.
 *
 * The original law object is NOT mutated; a new law object is returned.
 *
 * @param {object}   law           - Original law object
 * @param {string}   losingId      - deputyId of the losing region
 * @param {object[]} deputies      - Full deputies array (to read current indicators)
 * @returns {object} New law object with additional amendment effects
 */
export function buildAmendedLaw(law, losingId, deputies) {
  const deputy = deputies.find((d) => d.id === losingId);
  if (!deputy) throw new Error(`buildAmendedLaw: deputy "${losingId}" not found`);

  // Pick the indicator with the lowest current value for this deputy.
  const { economy, resources, cohesion } = deputy.indicators;
  const weakest =
    economy <= resources && economy <= cohesion
      ? 'economy'
      : resources <= cohesion
      ? 'resources'
      : 'cohesion';

  // Pick the sensitivity with the highest value for this deputy (biggest lever).
  const { sensitivity } = deputy;
  const bestSensitivity = Object.entries(sensitivity).reduce(
    (best, [key, val]) => (val > best[1] ? [key, val] : best),
    ['labour', -Infinity]
  )[0];

  const amendmentEffect = {
    indicator: weakest,
    delta: 3,
    sensitivity: bestSensitivity,
    isAmendment: true, // flag for UI display
  };

  return {
    ...law,
    id: `${law.id}-amended`,
    title: `${law.title} (amended)`,
    effects: [...law.effects, amendmentEffect],
  };
}

/**
 * Run the full amendment cycle:
 *   1. Find the losing region from the first vote results.
 *   2. Build an amended law.
 *   3. Re-simulate with the amended law.
 *
 * @param {object[]} deputies      - Deputies array (original or post-first-vote)
 * @param {object}   law           - Original law
 * @param {ReturnType<typeof computeDeputyResult>[]} firstResults - First vote results
 * @returns {{
 *   amendedLaw: object,
 *   losingId: string,
 *   secondResults: ReturnType<typeof computeDeputyResult>[]
 * }}
 */
export function runAmendmentCycle(deputies, law, firstResults) {
  const losingId     = findLosingRegion(firstResults);
  const amendedLaw   = buildAmendedLaw(law, losingId, deputies);
  const secondResults = simulateLaw(deputies, amendedLaw);

  return { amendedLaw, losingId, secondResults };
}

// ---------------------------------------------------------------------------
// Dev-mode self-test (min-wage verification from design.md)
// ---------------------------------------------------------------------------

if (import.meta.env?.DEV) {
  const minWageLaw = {
    id: 'min-wage',
    effects: [
      { indicator: 'economy',  delta: -2.5, sensitivity: 'labour'     },
      { indicator: 'cohesion', delta:  5,   sensitivity: 'investment' },
    ],
  };

  const testDeputies = [
    { id: 'tunis',       sensitivity: { labour: 1.0, investment: 1.0 } },
    { id: 'sidi-bouzid', sensitivity: { labour: 1.5, investment: 1.2 } },
    { id: 'gafsa',       sensitivity: { labour: 1.2, investment: 1.5 } },
    { id: 'sfax',        sensitivity: { labour: 2.0, investment: 1.0 } },
    { id: 'kasserine',   sensitivity: { labour: 1.1, investment: 1.6 } },
  ];

  const expected = {
    tunis:       'APPROVE',
    'sidi-bouzid': 'ABSTAIN',
    gafsa:       'APPROVE',
    sfax:        'REJECT',
    kasserine:   'APPROVE',
  };

  let passed = true;
  for (const deputy of testDeputies) {
    // computeDeputyResult only uses deputy.id and deputy.sensitivity
    const result = computeDeputyResult(deputy, minWageLaw);
    if (result.vote !== expected[deputy.id]) {
      console.warn(
        `[REGIA engine] Min-wage self-test FAILED for ${deputy.id}: ` +
        `expected ${expected[deputy.id]}, got ${result.vote} (net=${result.netScore})`
      );
      passed = false;
    }
  }

  if (passed) {
    console.info('[REGIA engine] Min-wage self-test passed ✓ (3 APPROVE / 1 REJECT / 1 ABSTAIN)');
  }
}
