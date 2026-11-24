// REGIA — Tunisian deputies data
// Starting indicators are SIMULATION values (0-100), NOT real statistics.
// Facts are grounded in the sources listed in regia-deputies-tunisia.md.
// Re-verify every fact on build day (29 Nov).

export const deputies = [
  {
    id: 'tunis',
    region: 'Tunis',
    title: 'The Capital',
    issues: ['Transport & services', 'Cost of living', 'Public services'],
    facts: [
      { text: 'Grand Tunis has about 2.7M inhabitants and is the administration and services hub.', source: 'National statistics (INS)' },
      { text: 'Tunis has the highest regional development level in the country.', source: 'Regional development indicator (ITCEQ/INS)' },
    ],
    indicators: { economy: 62, resources: 58, cohesion: 55 },
    sensitivity: { labour: 1.0, water: 0.8, investment: 1.0, tax: 1.2 },
  },
  {
    id: 'sidi-bouzid',
    region: 'Sidi Bouzid',
    title: 'The Farmer',
    issues: ['Agriculture & water', 'Irrigation', 'Farm jobs'],
    facts: [
      { text: 'Rainfall is only 100–300 mm/year; water scarcity and aquifer overuse are the major constraint.', source: 'CGIAR Béni Khedache–Sidi Bouzid profile' },
      { text: 'Agriculture provides 40–70% of household income; poverty incidence ~40% in the north of the zone.', source: 'CGIAR Béni Khedache–Sidi Bouzid profile' },
      { text: 'Crops: olives, almonds, barley, irrigated horticulture; sheep farming is dominant.', source: 'CGIAR / PLOS ONE 2022' },
    ],
    indicators: { economy: 38, resources: 34, cohesion: 48 },
    sensitivity: { labour: 1.5, water: 1.6, investment: 1.2, tax: 0.8 },
  },
  {
    id: 'gafsa',
    region: 'Gafsa',
    title: 'The Miner',
    issues: ['Employment & industry', 'Phosphate jobs', 'Pollution'],
    facts: [
      { text: '2010 phosphate production exceeded 8.5M tons, about 4.3% of world supply.', source: 'OTE Working Paper n°12 (2022)' },
      { text: 'Mineral wealth alongside high unemployment, poverty and pollution — a local resource curse.', source: 'Resource Justice, The Local Resource Curse (Gafsa)' },
      { text: '2008 Redeyef protests lasted 6 months over phosphate company recruitment.', source: 'Resource Justice / press archives' },
    ],
    indicators: { economy: 30, resources: 36, cohesion: 40 },
    sensitivity: { labour: 1.2, water: 1.0, investment: 1.5, tax: 0.9 },
  },
  {
    id: 'sfax',
    region: 'Sfax',
    title: 'The Industrial Port',
    issues: ['Industry & environment', 'Port & logistics', 'Exports'],
    facts: [
      { text: 'Second city of Tunisia (~1M inhabitants), major Mediterranean port and industrial centre.', source: 'National statistics (INS)' },
      { text: 'Olive-oil capital; phosphate is processed and exported via Sfax.', source: 'Sector profiles' },
    ],
    indicators: { economy: 58, resources: 55, cohesion: 52 },
    sensitivity: { labour: 2.0, water: 1.1, investment: 1.0, tax: 1.3 },
  },
  {
    id: 'kasserine',
    region: 'Kasserine',
    title: 'The Interior',
    issues: ['Regional development', 'Infrastructure', 'Jobs'],
    facts: [
      { text: 'Consistently among the lowest-ranked governorates on the regional development indicator.', source: 'OTE Working Paper n°12, Fig. 6' },
      { text: 'Mountainous interior (Jebel Chaambi); agriculture: olives and Sbiba apples; border region.', source: 'Regional profiles' },
    ],
    indicators: { economy: 32, resources: 30, cohesion: 45 },
    sensitivity: { labour: 1.1, water: 1.0, investment: 1.6, tax: 0.8 },
  },
];
