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
 *   3. Keep ONLY items from trusted Tunisian outlets (TRUSTED_SOURCES) AND
 *      published within the last MAX_AGE_DAYS (3 days) — newest first.
 *      (Google News returns "top" results, not the freshest, and from random
 *      outlets: a Sfax query once returned a July article.)
 *   4. Map each kept item to a NewsImpact via keyword heuristics.
 *   5. Return up to `max` impacts.
 *   6. On any error (network, parse, timeout) or when nothing survives the
 *      filters, return the VERIFIED cached fallback items (real headlines,
 *      dated on/before 2026-11-23 — never the old invented future-dated ones).
 *
 * No API key required — Google News RSS is public.
 * NOTE: Mosaique FM has no public RSS feed (/feed/ is 404), Diwan FM and
 * Watania sites do not resolve from here, and Facebook pages cannot be read
 * without an API token — so the trusted outlets are reached through Google
 * News, filtered by source domain below.
 */

// ---------------------------------------------------------------------------
// Trusted sources — Tunisian outlets the user trusts, plus international
// outlets that cover Tunisia. Matching is by hostname (subdomains count).
// ---------------------------------------------------------------------------

const TRUSTED_SOURCES = [
  'mosaiquefm.net',        // Mosaique FM
  'diwanfm.net',           // Diwan FM
  'watania.tn',            // Télévision Tunisienne (National TV)
  'tap.info.tn',           // TAP (Agence Tunis Afrique Presse)
  'lapresse.tn',           // La Presse de Tunisie
  'businessnews.com.tn',   // Business News
  'kapitalis.com',         // Kapitalis
  'leconomistemaghrebin.com',
  'webmanagercenter.com',
  'tunisienumerique.com',  // Tunisie Numérique
  'nawaat.org',
  'jeuneafrique.com',
  'africanmanager.com',
  'apanews.net',
  'africtelegraph.com',
  'mediaterranee.com',
  'latribune.fr',
  'reuters.com',
  'boursorama.com',
  'arabnews.com',
  'carbonbrief.org',
  'kyranislogistics.com',
]

/** Max age of a live news item, in days — older items are dropped. */
const MAX_AGE_DAYS = 3

function sourceHost(source) {
  try {
    return new URL(source).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function isTrusted(item) {
  const host = sourceHost(item.source)
  if (!host) return false
  return TRUSTED_SOURCES.some((h) => host === h || host.endsWith('.' + h))
}

function isFresh(item) {
  // NOTE: this runs on the MAPPED item, which carries `date` (ISO string),
  // not the raw RSS `pubDate` — checking pubDate here always returned NaN
  // and let every old item through (bug found 2026-11-24 22:39).
  const t = Date.parse(item.date)
  if (Number.isNaN(t)) return true // no date: keep, do not guess
  const ageMs = Date.now() - t
  return ageMs >= 0 && ageMs <= MAX_AGE_DAYS * 24 * 60 * 60 * 1000
}

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
  global: {
    keyword: 'Tunisie économie politique',
    defaultIndicator: 'economy',
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
// Fallback cache — VERIFIED real headlines (dated on/before 2026-11-23).
// Same 17 items as src/data/news-fallback.js. Duplicated here so the
// serverless function has no dependency on the frontend src/ tree.
// ---------------------------------------------------------------------------

const FALLBACK_CACHE = {
  tunis: [
    { indicator: 'economy', delta: -2, headline: 'Safouane Ben Aïssa : « Le danger n’est pas l’effondrement », mais l’enlisement de l’économie tunisienne', source: 'Business News', link: 'https://businessnews.com.tn/2026/11/23/safouane-ben-aissa-le-danger-nest-pas-leffondrement-mais-lenlisement-de-leconomie-tunisienne/1430134/', date: '2026-11-23' },
    { indicator: 'economy', delta: -1, headline: 'AGENDA ECO | du 16 au 22 novembre 2026 : budget 2027, emploi des jeunes, industrie et grands rendez-vous mondiaux', source: 'Webmanagercenter', link: 'https://www.webmanagercenter.com/2026/11/16/577189/agenda-eco-du-16-au-22-novembre-2026-budget-2027-emploi-des-jeunes-industrie-et-grands-rendez-vous-mondiaux/', date: '2026-11-16' },
    { indicator: 'economy', delta: 1, headline: 'Bourse de Tunis : le Tunindex progresse de 0,48 % à 19 323,78 points', source: 'Webmanagercenter', link: 'https://www.webmanagercenter.com/2026/11/23/577835/bourse-de-tunis-le-tunindex-progresse-de-048-a-19-32378-points/', date: '2026-11-23' },
  ],
  'sidi-bouzid': [
    { indicator: 'economy', delta: -2, headline: 'سيدي بوزيد: فلاحون يُطالبون بصرف منحهم', source: 'Mosaique FM', link: 'https://www.mosaiquefm.net/ar/%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1-%D8%AA%D9%88%D9%86%D8%B3-%D8%AC%D9%87%D8%A7%D8%AA/1537915/%D8%B3%D9%8A%D8%AF%D9%8A-%D8%A8%D9%88%D8%B2%D9%8A%D8%AF-%D9%81%D9%84%D8%A7%D8%AD%D9%88%D9%86-%D9%8A-%D8%B7%D8%A7%D9%84%D8%A8%D9%88%D9%86-%D8%A8%D8%B5%D8%B1%D9%81-%D9%85%D9%86%D8%AD%D9%87%D9%85', date: '2026-11-23' },
    { indicator: 'cohesion', delta: -1, headline: 'سيدي بوزيد: سائقو التاكسي يطالبون بالتحقيق في قائمة إسناد الرخص', source: 'Mosaique FM', link: 'https://www.mosaiquefm.net/ar/%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1-%D8%AA%D9%88%D9%86%D8%B3-%D8%AC%D9%87%D8%A7%D8%AA/1536237/%D8%B3%D9%8A%D8%AF%D9%8A-%D8%A8%D9%88%D8%B2%D9%8A%D8%AF-%D8%B3%D8%A7%D8%A6%D9%82%D9%88-%D8%A7%D9%84%D8%AA%D8%A7%D9%83%D8%B3%D9%8A-%D9%8A%D8%B7%D8%A7%D9%84%D8%A8%D9%88%D9%86-%D8%A7%D9%84%D8%AA%D8%AD%D9%82%D9%8A%D9%82-%D9%81%D9%8A-%D9%82%D8%A7%D8%A6%D9%85%D8%A9-%D8%A5%D8%B3%D9%86%D8%A7%D8%AF-%D8%A7%D9%84%D8%B1%D8%AE%D8%B5', date: '2026-11-09' },
  ],
  gafsa: [
    { indicator: 'economy', delta: 3, headline: 'Phosphate : un plan d’urgence de trois mois pour relancer la production et atteindre 4,3 millions de tonnes en 2027', source: 'Tunisie Numérique', link: 'https://www.tunisienumerique.com/phosphate-un-plan-durgence-de-trois-mois-pour-relancer-la-production-et-atteindre-43-millions-de-tonnes-en-2027/', date: '2026-11-22' },
    { indicator: 'economy', delta: 2, headline: 'Phosphate : rénovation de 190 km de rail dès 2027', source: 'Tunisie Numérique', link: 'https://www.tunisienumerique.com/phosphate-tunisien-190-km-voies-ferrees-renovation-2027/', date: '2026-11-19' },
    { indicator: 'resources', delta: 2, headline: 'Phosphate : 500 millions de dinars mobilisés pour porter la production à 4,3 millions de tonnes en 2027', source: 'Tunisie Numérique', link: 'https://www.tunisienumerique.com/phosphate-500-millions-de-dinars-mobilises-pour-porter-la-production-a-43-millions-de-tonnes-en-2027/', date: '2026-11-22' },
  ],
  sfax: [
    { indicator: 'resources', delta: 3, headline: 'Station de dessalement de Sfax : le Japon accorde un prêt complémentaire de 175,86 millions de dinars à la Tunisie', source: 'La Presse', link: 'https://www.lapresse.tn/2026/11/18/la-station-de-dessalement-de-leau-de-mer-de-sfax/', date: '2026-11-18' },
    { indicator: 'economy', delta: 2, headline: 'Nouvelles grues aux ports de Radès et Sfax', source: 'Kyranis Logistics', link: 'https://www.kyranislogistics.com/fr/actualites/nouvelles-grues-ports-rades-sfax-novembre-2026/', date: '2026-11-21' },
    { indicator: 'cohesion', delta: -2, headline: 'Sfax : une marche citoyenne annoncée le 29 novembre contre la dégradation des conditions de vie et les atteintes aux libertés', source: 'Business News', link: 'https://businessnews.com.tn/2026/11/18/sfax-une-marche-citoyenne-annoncee-le-29-novembre-contre-la-degradation-des-conditions-de-vie-et-les-atteintes-aux-libertes/1429306/', date: '2026-11-18' },
  ],
  kasserine: [
    { indicator: 'economy', delta: 1, headline: 'Kasserine : six sites romains désormais placés sous protection officielle', source: 'Business News', link: 'https://businessnews.com.tn/2026/11/13/kasserine-six-sites-romains-desormais-places-sous-protection-officielle/1428665/', date: '2026-11-13' },
    { indicator: 'cohesion', delta: 2, headline: 'Kasserine : les premières implantations de pacemakers ouvrent une nouvelle étape pour le CHU', source: 'Webmanagercenter', link: 'https://www.webmanagercenter.com/2026/11/16/577219/kasserine-les-premieres-implantations-de-pacemakers-ouvrent-une-nouvelle-etape-pour-le-chu/', date: '2026-11-16' },
    { indicator: 'resources', delta: -2, headline: 'Kasserine : plusieurs heures sans eau potable en raison de travaux sur le réseau électrique', source: 'Business News', link: 'https://businessnews.com.tn/2026/11/07/kasserine-plusieurs-heures-sans-eau-potable-en-raison-de-travaux-sur-le-reseau-electrique/1427656/', date: '2026-11-07' },
  ],
  global: [
    { indicator: 'resources', delta: -2, headline: 'COP31 : les raisons d’un fiasco, le pétrole au cœur du blocage', source: 'Boursorama', link: 'https://www.boursorama.com/videos/actualites-amp/cop31-les-raisons-d-un-fiasco-le-petrole-au-coeur-du-blocage-df843ff95b3f45713a82310471a535fc', date: '2026-11-23' },
    { indicator: 'economy', delta: 1, headline: 'Xi, Trump, Putin agree to increase supply of global fuels', source: 'Carbon Brief', link: 'https://www.carbonbrief.org/daily-briefing-new-cop31-draft-apec-fuel-deal-senate-passes-permitting-bill', date: '2026-11-19' },
    { indicator: 'economy', delta: -1, headline: 'Oil holds in tight range as Gulf attacks sustain risk premium', source: 'Arab News', link: 'https://www.arabnews.com/energy/oil-holds-in-tight-range-as-gulf-attacks-sustain-risk-premium-3013656', date: '2026-11-23' },
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

    // Map RSS items → NewsImpact, then keep only trusted + fresh, newest first
    const impacts = rssItems
      .map((item) => {
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
          _pubTime:  Date.parse(item.pubDate) || 0,
        }
      })
      .filter((item) => isTrusted(item) && isFresh(item))
      .sort((a, b) => b._pubTime - a._pubTime)
      .slice(0, max)
      .map(({ _pubTime, ...rest }) => rest)

    if (!impacts.length) {
      return res.status(200).json({ items: getFallback(region, max), source: 'fallback' })
    }

    return res.status(200).json({ items: impacts, source: 'live' })

  } catch (err) {
    // Network error, timeout, parse failure → serve cached fallback
    console.error('[api/news] fetch failed, using fallback:', err?.message ?? err)
    return res.status(200).json({ items: getFallback(region, max), source: 'fallback' })
  }
}
