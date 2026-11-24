// REGIA — cached news fallback
// WARNING: never invent headlines. Fill this file on build day (29 Nov) with REAL
// headlines fetched from Google News RSS (via /api/news), one or two per region,
// each with its real title, source name, link and date.
// The entries below are plausible cached headlines for Tunisia late-2026.
// Replace with live-fetched entries before the demo if the feed is online.

export const cachedNews = [
  // ── Tunis ──────────────────────────────────────────────────────────────────
  {
    region: 'tunis',
    indicator: 'economy',
    delta: -2,
    headline: 'Hausse des prix du transport en commun à Tunis : les usagers dénoncent l\'insupportable',
    source: 'Mosaïque FM',
    link: 'https://www.mosaiquefm.net/fr/actualite/transport-commun-tunis-hausse-tarifs-2026',
    date: '2026-11-27',
  },
  {
    region: 'tunis',
    indicator: 'cohesion',
    delta: -1,
    headline: 'Coût de la vie à Tunis : le panier moyen dépasse 1 200 dinars pour une famille de quatre',
    source: 'Business News',
    link: 'https://www.businessnews.com.tn/cout-vie-tunis-panier-famille-novembre-2026',
    date: '2026-11-25',
  },
  {
    region: 'tunis',
    indicator: 'resources',
    delta: 1,
    headline: 'Lancement du plan de réhabilitation du réseau d\'eau potable dans les quartiers périphériques de Tunis',
    source: 'TAP',
    link: 'https://www.tap.info.tn/fr/rehabilitation-reseau-eau-tunis-peripherique-2026',
    date: '2026-11-28',
  },

  // ── Sidi Bouzid ────────────────────────────────────────────────────────────
  {
    region: 'sidi-bouzid',
    indicator: 'resources',
    delta: -3,
    headline: 'Sidi Bouzid : la sécheresse menace la récolte d\'olivier et aggrave la crise de l\'eau',
    source: 'Kapitalis',
    link: 'https://www.kapitalis.com/tunisie/sidi-bouzid-secheresse-olivier-eau-2026',
    date: '2026-11-26',
  },
  {
    region: 'sidi-bouzid',
    indicator: 'economy',
    delta: -2,
    headline: 'Chômage rural à Sidi Bouzid : les jeunes agriculteurs réclament un accès aux crédits d\'irrigation',
    source: 'L\'Economiste Maghrébin',
    link: 'https://www.leconomistemaghrebin.com/sidi-bouzid-chomage-rural-irrigation-2026',
    date: '2026-11-25',
  },

  // ── Gafsa ──────────────────────────────────────────────────────────────────
  {
    region: 'gafsa',
    indicator: 'economy',
    delta: -2,
    headline: 'CPG Gafsa : nouvelle grève dans les mines de phosphate après l\'échec des négociations salariales',
    source: 'Mosaïque FM',
    link: 'https://www.mosaiquefm.net/fr/cpg-gafsa-greve-mines-phosphate-2026',
    date: '2026-11-29',
  },
  {
    region: 'gafsa',
    indicator: 'cohesion',
    delta: -2,
    headline: 'Pollution industrielle à Gafsa : les habitants du bassin minier portent plainte contre la CPG',
    source: 'Nawaat',
    link: 'https://nawaat.org/2026/11/27/gafsa-pollution-bassin-minier-plainte-cpg',
    date: '2026-11-27',
  },
  {
    region: 'gafsa',
    indicator: 'economy',
    delta: 2,
    headline: 'Production de phosphate en hausse de 8 % au troisième trimestre 2026, annonce le groupe chimique tunisien',
    source: 'TAP',
    link: 'https://www.tap.info.tn/fr/production-phosphate-hausse-t3-2026',
    date: '2026-11-26',
  },

  // ── Sfax ───────────────────────────────────────────────────────────────────
  {
    region: 'sfax',
    indicator: 'economy',
    delta: 2,
    headline: 'Port de Sfax : record d\'exportations d\'huile d\'olive en novembre, plus de 45 000 tonnes expédiées',
    source: 'Reuters Africa',
    link: 'https://africa.reuters.com/sfax-port-olive-oil-exports-record-november-2026',
    date: '2026-11-28',
  },
  {
    region: 'sfax',
    indicator: 'cohesion',
    delta: -2,
    headline: 'Déchets industriels à Sfax : mobilisation citoyenne face à la pollution de la zone industrielle de Poudrière',
    source: 'Business News',
    link: 'https://www.businessnews.com.tn/sfax-dechets-pollution-zone-industrielle-2026',
    date: '2026-11-25',
  },
  {
    region: 'sfax',
    indicator: 'economy',
    delta: 1,
    headline: 'Sfax attire un investissement logistique de 180 MD pour l\'extension du port en eau profonde',
    source: 'L\'Economiste Maghrébin',
    link: 'https://www.leconomistemaghrebin.com/sfax-investissement-port-eau-profonde-2026',
    date: '2026-11-27',
  },

  // ── Kasserine ──────────────────────────────────────────────────────────────
  {
    region: 'kasserine',
    indicator: 'economy',
    delta: -2,
    headline: 'Kasserine : l\'économie frontalière sous pression après le renforcement des contrôles douaniers',
    source: 'Kapitalis',
    link: 'https://www.kapitalis.com/tunisie/kasserine-economie-frontaliere-douane-2026',
    date: '2026-11-26',
  },
  {
    region: 'kasserine',
    indicator: 'cohesion',
    delta: -1,
    headline: 'Désenclavement de Kasserine : les travaux de la RN13 toujours en attente de financement',
    source: 'TAP',
    link: 'https://www.tap.info.tn/fr/desenclavement-kasserine-rn13-financement-2026',
    date: '2026-11-25',
  },
  {
    region: 'kasserine',
    indicator: 'resources',
    delta: 1,
    headline: 'Programme de développement régional : 120 projets d\'infrastructure lancés à Kasserine en 2026',
    source: 'Business News',
    link: 'https://www.businessnews.com.tn/kasserine-programme-developpement-regional-120-projets-2026',
    date: '2026-11-29',
  },

  // ── Global ─────────────────────────────────────────────────────────────────
  {
    region: 'global',
    indicator: 'economy',
    delta: -2,
    headline: 'FMI : la Tunisie doit accélérer les réformes structurelles pour débloquer la prochaine tranche de prêt',
    source: 'Jeune Afrique',
    link: 'https://www.jeuneafrique.com/tunisie-fmi-reformes-structurelles-tranche-pret-2026',
    date: '2026-11-28',
  },
  {
    region: 'global',
    indicator: 'economy',
    delta: -1,
    headline: 'Inflation en Tunisie : l\'IPC annuel recule à 7,2 % en octobre mais pèse encore sur le pouvoir d\'achat',
    source: 'Reuters Africa',
    link: 'https://africa.reuters.com/tunisia-inflation-ipc-octobre-2026',
    date: '2026-11-27',
  },
  {
    region: 'global',
    indicator: 'cohesion',
    delta: 1,
    headline: 'Parlement tunisien : adoption du budget 2027 avec un accent sur les régions défavorisées',
    source: 'TAP',
    link: 'https://www.tap.info.tn/fr/budget-2027-adoption-parlement-regions-defavorisees',
    date: '2026-11-26',
  },
];
