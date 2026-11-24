// REGIA — Preset laws data
// All delta values are SIMULATION values for a demo, NOT real economic forecasts.
// Each effect has:
//   indicator  — which deputy metric changes ('economy' | 'resources' | 'cohesion')
//   delta      — base change before per-region scaling (can be fractional)
//   sensitivity — which deputy sensitivity key scales this effect
//                 ('labour' | 'water' | 'investment' | 'tax')
//
// Net score per deputy = 2×Δeconomy + 1×Δresources + 1.5×Δcohesion
// where Δindicator = sum of (effect.delta × deputy.sensitivity[effect.sensitivity])
//       for all effects on that indicator.
// Vote: net > +2 → APPROVE | net < −2 → REJECT | else → ABSTAIN
//
// Min-wage verification (required by design.md testing section):
//   economy effect: delta=−2.5, sensitivity='labour'
//   cohesion effect: delta=+5,  sensitivity='investment'
//   Net = 2×(−2.5×labour) + 1.5×(5×investment) = −5×labour + 7.5×investment
//   Tunis      labour=1.0 invest=1.0  → −5.0 + 7.5  =  2.5  APPROVE ✓
//   Sidi Bouzid labour=1.5 invest=1.2  → −7.5 + 9.0  =  1.5  ABSTAIN ✓
//   Gafsa      labour=1.2 invest=1.5  → −6.0 + 11.25 =  5.25 APPROVE ✓
//   Sfax       labour=2.0 invest=1.0  → −10.0 + 7.5  = −2.5  REJECT  ✓
//   Kasserine  labour=1.1 invest=1.6  → −5.5 + 12.0  =  6.5  APPROVE ✓

export const laws = [
  {
    id: 'min-wage',
    title: 'Minimum wage +20%',
    description:
      'Raise the national minimum wage by 20%. Workers gain purchasing power; employers in labour-intensive sectors face higher payroll costs.',
    effects: [
      // Higher wages increase unit costs, hurting labour-intensive economies
      { indicator: 'economy', delta: -2.5, sensitivity: 'labour' },
      // Social uplift boosts cohesion; felt more in regions with high social investment capacity
      { indicator: 'cohesion', delta: 5, sensitivity: 'investment' },
    ],
  },
  {
    id: 'business-tax',
    title: 'Business tax −15%',
    description:
      'Cut corporate tax rates by 15%. Firms retain more profit; investment climate improves; redistributive capacity decreases.',
    effects: [
      // Lower tax burden frees capital for reinvestment
      { indicator: 'economy', delta: 3.5, sensitivity: 'tax' },
      // Improved business environment attracts resources and infrastructure spending
      { indicator: 'resources', delta: 2, sensitivity: 'investment' },
      // Reduced public revenue may weaken social cohesion in dependent regions
      { indicator: 'cohesion', delta: -1.5, sensitivity: 'tax' },
    ],
  },
  {
    id: 'water-subsidy',
    title: 'Water subsidy for farmers',
    description:
      'Subsidise irrigation water and drought-resilience infrastructure for agricultural regions. Directly aids water-scarce areas.',
    effects: [
      // Cheaper water inputs raise agricultural output and income
      { indicator: 'economy', delta: 2.5, sensitivity: 'water' },
      // Water infrastructure investment improves regional resource base
      { indicator: 'resources', delta: 3, sensitivity: 'water' },
      // Reduced rural hardship strengthens community cohesion
      { indicator: 'cohesion', delta: 1.5, sensitivity: 'water' },
    ],
  },
  {
    id: 'infrastructure',
    title: 'Infrastructure investment in interior regions',
    description:
      'Direct public spending toward roads, utilities, and connectivity in under-developed interior governorates.',
    effects: [
      // Better infrastructure unlocks economic activity and lowers logistics costs
      { indicator: 'economy', delta: 2, sensitivity: 'investment' },
      // Core purpose of the law: build up the resource and infrastructure base
      { indicator: 'resources', delta: 4, sensitivity: 'investment' },
      // Visible state investment raises civic trust and regional cohesion
      { indicator: 'cohesion', delta: 2.5, sensitivity: 'investment' },
    ],
  },
];

/**
 * Returns the law object for the given id, or undefined if not found.
 * @param {string} id
 * @returns {typeof laws[number] | undefined}
 */
export function getLawById(id) {
  return laws.find((law) => law.id === id);
}
