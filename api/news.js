/**
 * REGIA — Vercel serverless function: /api/news
 *
 * Query params:
 *   region   (required) — deputy id: 'tunis' | 'sidi-bouzid' | 'gafsa' | 'sfax' | 'kasserine'
 *   lang     (optional) — 'fr' (default) | 'en'
 *   max      (optional) — max items to return, 1–10 (default 3)
 *
 * Returns:
 *   { items: NewsImpact[], source: 'live' | 'fallback' }
 *
 * NewsImpact shape:
 *   { region, indicator, delta, headline, source, link, date }
 *
 * Flow:
 *   1. Fetch Google News RSS for the region keyword.
 *   2. Parse XML titles / links / pubDates.
 *   3. Map each item to a NewsImpact via keyword heuristics.
 *   4. Return up to `max` impacts.
 *   5. On any error (network, parse, timeout), return cached fallback items.
 *
 * No API key required — Google News RSS is public.
 */

// ---------------------------------------------------------------------------
// Region → search keyword + indicator heuristics
// ---------------------------------------------------------------------------

const REGION_CONFIG = {
  tunis: {
    keyword: 'Tunis Tunisie',
    defaultIndicator: 'economy',
    defaultDelta: -1,
  },
  'sidi-bouzid': {
    keyword: 'Sidi Bouzid Tunisie',
    defaultIndicator: 'resources',
    defaultDelta: -2,
  },
  gafsa: {
    keyword: 'Gafsa phosphate Tunisie',
    defaultIndicator: 'economy',
    defaultDelta: -1,
  },
  sfax: {
    keyword: 'Sfax Tunisie',
    defaultIndicator: 'economy',
    defaultDelta: 1,
  },
  kasserine: {
    keyword: 'Kasserine Tunisie',
    defaultIndicator: 'cohesion',
    defaultDelta: -1,
  },
}

/** Keyword → { indicator, delta } override table (checked against lowercased title) */
const KEYWORD_IMPACTS = [
  // Positive economy signals
  { words: ['hausse', 'croissance', 'record', 'exportation', 'investissement', 'emploi', 'growth', 'export', 'investment'], indicator: 'economy', delta: 2 },
  // Negative economy signals
  { words: ['grève', 'chômage', 'crise', 'inflation', 'pauvreté', 'strike', 'unemployment', 'poverty', 'crisis'], indicator: 'economy', delta: -2 },
  // Resource signals
  { words: ['eau', 'sécheresse', 'irrigation', 'water', 'drought', 'ressource', 'phosphate', 'agriculture'], indicator: 'resources', delta: -2 },
  { words: ['barrage', 'infrastructure', 'réseau', 'dam', 'pipeline', 'reservoir'], indicator: 'resources', delta: 2 },
  // Cohesion signals
  { words: ['protestation', 'manifestation', 'violence', 'protest', 'riot', 'tension', 'pollution'], indicator: 'cohesion', delta: -2 },
  { words: ['accord', 'paix', 'développement', 'accord', 'agreement', 'peace', 'solidarity'], indicator: 'cohesion', delta: 2 },
]

/** Derive indicator + delta from a headline string */
function classifyHeadline(title) {
  const lower = title.toLowerCase()
  for (const rule of KEYWORD_IMPACTS) {
    if (rule.words.some((w) => lower.includes(w))) {
      return { indicator: rule.indicator, delta: rule.delta }
    }
  }
  return null // caller uses region default
}

// ---------------------------------------------------------------------------
// Minimal RSS/XML parser (no DOM, no external deps)
// Handles Google News RSS which is well-formed UTF-8 XML.
// ---------------------------------------------------------------------------

/** Extract all <item> blocks from RSS XML string */
function parseRssItems(xml) {
  const items = []
  const itemRe = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1]

    const title = decodeHtmlEntities(extractTag(block, 'title'))
    const link  = extractTag(block, 'link') || extractTag(block, 'guid')
    const pubDate = extractTag(block, 'pubDate')
    const sourceName = extractAttr(block, 'source', 'url') || extractTag(block, 'source') || ''

    if (title) {
      items.push({ title, link: link?.trim() ?? '', pubDate: pubDate?.trim() ?? '', source: sourceName })
    }
  }

  return items
}

function extractTag(str, tag) {
  const re = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i')
  const m = re.exec(str)
  if (!m) return ''
  return (m[1] ?? m[2] ?? '').trim()
}

function extractAttr(str, tag, attr) {
  const re = new RegExp(`<${tag}[^>]+${attr}="([^"]*)"`, 'i')
  const m = re.exec(str)
  return m ? m[1].trim() : ''
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
}

// ---------------------------------------------------------------------------
// Fallback cache (mirrors src/data/news-fallback.js — duplicated here so the
// serverless function has no dependency on the frontend src/ tree)
// ---------------------------------------------------------------------------

const FALLBACK_CACHE = {
  tunis: [
    { indicator: 'economy',   delta: -2, headline: 'Hausse des prix du transport en commun à Tunis : les usagers dénoncent l\'insupportable', source: 'Mosaïque FM', link: 'https://www.mosaiquefm.net/fr/actualite/transport-commun-tunis-hausse-tarifs-2026', date: '2026-11-27' },
    { indicator: 'cohesion',  delta: -1, headline: 'Coût de la vie à Tunis : le panier moyen dépasse 1 200 dinars pour une famille de quatre', source: 'Business News', link: 'https://www.businessnews.com.tn/cout-vie-tunis-panier-famille-novembre-2026', date: '2026-11-25' },
    { indicator: 'resources', delta:  1, headline: 'Lancement du plan de réhabilitation du réseau d\'eau potable dans les quartiers périphériques de Tunis', source: 'TAP', link: 'https://www.tap.info.tn/fr/rehabilitation-reseau-eau-tunis-peripherique-2026', date: '2026-11-28' },
  ],
  'sidi-bouzid': [
    { indicator: 'resources', delta: -3, headline: 'Sidi Bouzid : la sécheresse menace la récolte d\'olivier et aggrave la crise de l\'eau', source: 'Kapitalis', link: 'https://www.kapitalis.com/tunisie/sidi-bouzid-secheresse-olivier-eau-2026', date: '2026-11-26' },
    { indicator: 'economy',   delta: -2, headline: 'Chômage rural à Sidi Bouzid : les jeunes agriculteurs réclament un accès aux crédits d\'irrigation', source: 'L\'Economiste Maghrébin', link: 'https://www.leconomistemaghrebin.com/sidi-bouzid-chomage-rural-irrigation-2026', date: '2026-11-25' },
  ],
  gafsa: [
    { indicator: 'economy',   delta: -2, headline: 'CPG Gafsa : nouvelle grève dans les mines de phosphate après l\'échec des négociations salariales', source: 'Mosaïque FM', link: 'https://www.mosaiquefm.net/fr/cpg-gafsa-greve-mines-phosphate-2026', date: '2026-11-29' },
    { indicator: 'cohesion',  delta: -2, headline: 'Pollution industrielle à Gafsa : les habitants du bassin minier portent plainte contre la CPG', source: 'Nawaat', link: 'https://nawaat.org/2026/11/27/gafsa-pollution-bassin-minier-plainte-cpg', date: '2026-11-27' },
    { indicator: 'economy',   delta:  2, headline: 'Production de phosphate en hausse de 8 % au troisième trimestre 2026, annonce le groupe chimique tunisien', source: 'TAP', link: 'https://www.tap.info.tn/fr/production-phosphate-hausse-t3-2026', date: '2026-11-26' },
  ],
  sfax: [
    { indicator: 'economy',   delta:  2, headline: 'Port de Sfax : record d\'exportations d\'huile d\'olive en novembre, plus de 45 000 tonnes expédiées', source: 'Reuters Africa', link: 'https://africa.reuters.com/sfax-port-olive-oil-exports-record-november-2026', date: '2026-11-28' },
    { indicator: 'cohesion',  delta: -2, headline: 'Déchets industriels à Sfax : mobilisation citoyenne face à la pollution de la zone industrielle de Poudrière', source: 'Business News', link: 'https://www.businessnews.com.tn/sfax-dechets-pollution-zone-industrielle-2026', date: '2026-11-25' },
    { indicator: 'economy',   delta:  1, headline: 'Sfax attire un investissement logistique de 180 MD pour l\'extension du port en eau profonde', source: 'L\'Economiste Maghrébin', link: 'https://www.leconomistemaghrebin.com/sfax-investissement-port-eau-profonde-2026', date: '2026-11-27' },
  ],
  kasserine: [
    { indicator: 'economy',   delta: -2, headline: 'Kasserine : l\'économie frontalière sous pression après le renforcement des contrôles douaniers', source: 'Kapitalis', link: 'https://www.kapitalis.com/tunisie/kasserine-economie-frontaliere-douane-2026', date: '2026-11-26' },
    { indicator: 'cohesion',  delta: -1, headline: 'Désenclavement de Kasserine : les travaux de la RN13 toujours en attente de financement', source: 'TAP', link: 'https://www.tap.info.tn/fr/desenclavement-kasserine-rn13-financement-2026', date: '2026-11-25' },
    { indicator: 'resources', delta:  1, headline: '120 projets d\'infrastructure lancés à Kasserine dans le cadre du programme de développement régional 2026', source: 'Business News', link: 'https://www.businessnews.com.tn/kasserine-programme-developpement-regional-120-projets-2026', date: '2026-11-29' },
  ],
}

function getFallback(region, max) {
  const pool = FALLBACK_CACHE[region] ?? Object.values(FALLBACK_CACHE).flat()
  return pool.slice(0, max).map((item) => ({ ...item, region }))
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  // CORS — allow the Vite dev server and the deployed frontend
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600') // 5 min CDN cache

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { region = 'tunis', lang = 'fr', max: rawMax = '3' } = req.query ?? {}
  const max = Math.min(10, Math.max(1, parseInt(rawMax, 10) || 3))

  if (!REGION_CONFIG[region]) {
    return res.status(400).json({ error: `Unknown region: ${region}` })
  }

  const { keyword, defaultIndicator, defaultDelta } = REGION_CONFIG[region]

  try {
    // Google News RSS — no key, public, respects robots.txt for crawlers
    const rssUrl =
      `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}` +
      `&hl=${lang === 'en' ? 'en-TN' : 'fr-TN'}&gl=TN&ceid=TN:${lang === 'en' ? 'en' : 'fr'}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000) // 5 s timeout

    let xml
    try {
      const response = await fetch(rssUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'REGIA-parliament-simulator/1.0 (educational)' },
      })
      if (!response.ok) throw new Error(`RSS returned ${response.status}`)
      xml = await response.text()
    } finally {
      clearTimeout(timeout)
    }

    const rssItems = parseRssItems(xml)

    if (!rssItems.length) {
      return res.status(200).json({ items: getFallback(region, max), source: 'fallback' })
    }

    // Map RSS items → NewsImpact
    const impacts = rssItems.slice(0, max).map((item) => {
      const classified = classifyHeadline(item.title)
      return {
        region,
        indicator: classified?.indicator ?? defaultIndicator,
        delta:     classified?.delta     ?? defaultDelta,
        headline:  item.title,
        source:    item.source || 'Google News',
        link:      item.link,
        date:      item.pubDate
          ? new Date(item.pubDate).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
      }
    })

    return res.status(200).json({ items: impacts, source: 'live' })

  } catch (err) {
    // Network error, timeout, parse failure → serve cached fallback
    console.error('[api/news] fetch failed, using fallback:', err?.message ?? err)
    return res.status(200).json({ items: getFallback(region, max), source: 'fallback' })
  }
}
