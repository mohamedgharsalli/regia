/**
 * REGIA — Vercel serverless function: /api/debate
 *
 * POST body (JSON):
 * {
 *   deputies: Deputy[],          // current state with indicators + facts
 *   law: { id, title, description, effects[] },
 *   results: DeputyResult[],     // from engine.simulateLaw — net scores + deltas + vote
 * }
 *
 * Returns:
 * {
 *   lines: DebateLine[],         // one per deputy
 *   model: string,               // model used
 * }
 *
 * DebateLine:
 * {
 *   deputyId: string,
 *   reasoning: string,           // 1–2 sentences, grounded in numbers from results[]
 *   citedFact: string,           // verbatim from deputy.facts[]
 *   citedSource: string,         // source name for the cited fact
 * }
 *
 * Rules enforced in prompt:
 *   - LLM MUST use the net score from the payload, not invent one
 *   - LLM MUST cite one real fact from the deputy's dossier
 *   - LLM MUST NOT change the vote; it only explains it
 *   - Response MUST be a JSON array, no prose wrapper
 *
 * Fallback: if Gemini is unavailable or the response is malformed,
 * the function returns template-generated reasoning lines so the
 * UI always shows something meaningful.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent'

const REQUEST_TIMEOUT_MS = 20_000

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Build the single batched prompt for all 5 deputies.
 * All numbers are injected from the deterministic engine results.
 * The LLM's only job is to write 1–2 sentences of reasoning per deputy.
 */
function buildPrompt(deputies, law, results) {
  const resultMap = new Map(results.map((r) => [r.deputyId, r]))

  const deputySections = deputies.map((deputy) => {
    const r = resultMap.get(deputy.id)
    if (!r) return ''

    const facts = deputy.facts
      .map((f, i) => `  Fact ${i + 1}: "${f.text}" (Source: ${f.source})`)
      .join('\n')

    const deltaLines = [
      r.deltaEconomy   !== 0 ? `Economy: ${r.deltaEconomy > 0 ? '+' : ''}${r.deltaEconomy.toFixed(2)}` : null,
      r.deltaResources !== 0 ? `Resources: ${r.deltaResources > 0 ? '+' : ''}${r.deltaResources.toFixed(2)}` : null,
      r.deltaCohesion  !== 0 ? `Cohesion: ${r.deltaCohesion > 0 ? '+' : ''}${r.deltaCohesion.toFixed(2)}` : null,
    ].filter(Boolean).join(', ')

    return `
DEPUTY: ${deputy.id}
  Region: ${deputy.region} (${deputy.title})
  Current indicators: Economy ${deputy.indicators.economy}, Resources ${deputy.indicators.resources}, Cohesion ${deputy.indicators.cohesion}
  Dossier facts:
${facts}
  Law effect on this deputy: ${deltaLines || 'no change'}
  Net score: ${r.netScore.toFixed(2)}
  VOTE (FIXED — do not change): ${r.vote}`.trim()
  }).join('\n\n')

  return `You are a parliamentary debate writer for REGIA, a simplified educational parliament simulator.

LAW BEING DEBATED: "${law.title}"
Description: ${law.description}

For each of the 5 deputies below, write 1–2 sentences of spoken debate reasoning.

STRICT RULES:
1. Each deputy's reasoning MUST reflect their VOTE (shown as FIXED above). Do not contradict it.
2. Each deputy MUST cite one of their listed dossier facts. Quote or paraphrase it closely.
3. Do NOT invent numbers. If you mention an indicator change, use the exact delta shown above.
4. Write in first person as the deputy. Keep it concise and grounded — this is a parliament, not a speech.
5. Write in English.

${deputySections}

Respond with a JSON array ONLY — no markdown, no prose wrapper. Format:
[
  {
    "deputyId": "<id>",
    "reasoning": "<1–2 sentences>",
    "citedFact": "<verbatim or close paraphrase of the fact used>",
    "citedSource": "<source name>"
  },
  ...
]`
}

// ---------------------------------------------------------------------------
// Fallback generator (no LLM available)
// ---------------------------------------------------------------------------

const VOTE_PHRASES = {
  APPROVE: ['I support this law', 'This measure benefits my region', 'I vote in favour'],
  REJECT:  ['I oppose this law', 'This would harm my region', 'I cannot support this'],
  ABSTAIN: ['The effects are mixed for my region', 'I find myself unable to decide', 'I abstain given the trade-offs'],
}

function buildFallbackLines(deputies, results) {
  const resultMap = new Map(results.map((r) => [r.deputyId, r]))

  return deputies.map((deputy) => {
    const r = resultMap.get(deputy.id)
    const vote = r?.vote ?? 'ABSTAIN'
    const phrases = VOTE_PHRASES[vote]
    const phrase = phrases[Math.floor(Math.random() * phrases.length)]
    const fact = deputy.facts?.[0]

    return {
      deputyId:    deputy.id,
      reasoning:   `${phrase}. ${fact ? `As noted, ${fact.text.toLowerCase().replace(/\.$/, '')}.` : ''}`,
      citedFact:   fact?.text    ?? '',
      citedSource: fact?.source  ?? '',
    }
  })
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

function parseGeminiResponse(text) {
  // Strip optional markdown code fences
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  const parsed = JSON.parse(cleaned) // throws on malformed JSON

  if (!Array.isArray(parsed)) throw new Error('Response is not an array')
  if (!parsed.length)         throw new Error('Response array is empty')

  // Validate each entry has the required fields
  for (const item of parsed) {
    if (typeof item.deputyId !== 'string')  throw new Error('Missing deputyId')
    if (typeof item.reasoning !== 'string') throw new Error('Missing reasoning')
  }

  return parsed
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  const { deputies, law, results } = body ?? {}

  if (!Array.isArray(deputies) || !law || !Array.isArray(results)) {
    return res.status(400).json({ error: 'Missing required fields: deputies, law, results' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn('[api/debate] GEMINI_API_KEY not set — using fallback reasoning')
    return res.status(200).json({
      lines:  buildFallbackLines(deputies, results),
      model:  'fallback',
    })
  }

  const prompt = buildPrompt(deputies, law, results)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let geminiText
    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature:     0.4,   // low for consistent structured output
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          },
        }),
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        throw new Error(`Gemini returned ${response.status}: ${errText.slice(0, 200)}`)
      }

      const json = await response.json()
      geminiText = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    } finally {
      clearTimeout(timeout)
    }

    if (!geminiText) throw new Error('Empty response from Gemini')

    let lines
    try {
      lines = parseGeminiResponse(geminiText)
    } catch (parseErr) {
      console.error('[api/debate] JSON parse failed, using fallback:', parseErr?.message)
      lines = buildFallbackLines(deputies, results)
    }

    // Ensure every deputy has an entry (fill gaps with fallback)
    const lineMap = new Map(lines.map((l) => [l.deputyId, l]))
    const fallbackLines = buildFallbackLines(deputies, results)
    const merged = fallbackLines.map((fb) => lineMap.get(fb.deputyId) ?? fb)

    return res.status(200).json({ lines: merged, model: 'gemini-3.5-flash-lite' })

  } catch (err) {
    console.error('[api/debate] error, using fallback:', err?.message ?? err)
    return res.status(200).json({
      lines:  buildFallbackLines(deputies, results),
      model:  'fallback',
    })
  }
}
