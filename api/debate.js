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
 *   - VARIETY: each deputy opens with a DIFFERENT rhetorical move
 *     (question / number / consequence / challenge / personal stake),
 *     and NO deputy may open with a general description of their region.
 *     The cited fact comes AFTER the opening sentence, never as the opener.
 *
 * Fallback: if Gemini is unavailable or the response is malformed,
 * the function returns template-generated reasoning lines so the
 * UI always shows something meaningful. Fallback lines also vary:
 * random opening phrase, a delta-based clause, and a random fact.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent'

const REQUEST_TIMEOUT_MS = 20_000
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'openai/gpt-oss-120b'
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'openrouter/free'

// One distinct opening move per deputy (rotated by position in the list).
// This is what stops all five lines from starting with the same
// "Even though my region is..." regional-fact clause.
const OPENING_MOVES = [
  'Ask a pointed question about the law\u2019s real effect.',
  'Open with the exact number that matters most to your region (the largest delta).',
  'Open with a concrete consequence: what happens in your region if this law passes.',
  'Open by challenging one likely objection or a colleague\u2019s assumption.',
  'Open with what is personally at stake for the people of your region.',
]

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

  const deputySections = deputies.map((deputy, i) => {
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
  VOTE (FIXED — do not change): ${r.vote}
  OPENING MOVE (use this one, do not copy another deputy's opening): ${OPENING_MOVES[i % OPENING_MOVES.length]}`.trim()
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
6. VARIETY — this is mandatory: each deputy MUST open with the OPENING MOVE assigned to them above, and NO two deputies may open the same way. NEVER open with a general description of your region (no "Even though...", "As...", "Since...", "While..." + region fact). The cited dossier fact must come AFTER your opening sentence, never as the opening clause.
7. Each reasoning MUST mention at least one exact delta number from the law effect above — argue from what the law DOES to your region, not from your region's general profile.

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
  APPROVE: [
    'I support this law',
    'This measure benefits my region',
    'I vote in favour',
    'My region gains from this',
    'This is the right call for us',
  ],
  REJECT: [
    'I oppose this law',
    'This would harm my region',
    'I cannot support this',
    'My region loses under this law',
    'This is the wrong call for us',
  ],
  ABSTAIN: [
    'The effects are mixed for my region',
    'I find myself unable to decide',
    'I abstain given the trade-offs',
    'The gains and the losses cancel out for us',
    'I need more than this law offers to decide',
  ],
}

/** Pick a random element from an array */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Build a short clause from the deputy's largest indicator delta, e.g. "Economy +2.50 for us" */
function deltaClause(r) {
  if (!r) return ''
  const deltas = [
    { name: 'Economy',   value: r.deltaEconomy },
    { name: 'Resources', value: r.deltaResources },
    { name: 'Cohesion',  value: r.deltaCohesion },
  ].filter((d) => typeof d.value === 'number' && d.value !== 0)
  if (!deltas.length) return 'It changes little for us'
  deltas.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  const top = deltas[0]
  return `${top.name} ${top.value > 0 ? '+' : ''}${top.value.toFixed(2)} for us`
}

function buildFallbackLines(deputies, results) {
  const resultMap = new Map(results.map((r) => [r.deputyId, r]))

  return deputies.map((deputy) => {
    const r = resultMap.get(deputy.id)
    const vote = r?.vote ?? 'ABSTAIN'
    const phrase = pick(VOTE_PHRASES[vote])
    // Random fact, not always the first — otherwise every debate cites the same line
    const fact = deputy.facts?.length
      ? deputy.facts[Math.floor(Math.random() * deputy.facts.length)]
      : undefined

    return {
      deputyId:    deputy.id,
      reasoning:   `${phrase} — ${deltaClause(r)}.${fact ? ` As noted, ${fact.text.toLowerCase().replace(/\.$/, '')}.` : ''}`,
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
// Groq fallback (OpenAI-compatible chat API)
async function callGroq(prompt, apiKey, signal) {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`Groq returned ${response.status}: ${errText.slice(0, 200)}`)
  }

  const json = await response.json()
  return json?.choices?.[0]?.message?.content ?? ''
}
// OpenRouter free-model router (OpenAI-compatible chat API)
async function callOpenRouter(prompt, apiKey, signal) {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://regia-blond.vercel.app',
      'X-Title': 'REGIA',
    },
    signal,
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  })
  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`OpenRouter returned ${response.status}: ${errText.slice(0, 200)}`)
  }
  const json = await response.json()
  return json?.choices?.[0]?.message?.content ?? ''
}
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
const groqKey = process.env.GROQ_API_KEY
const openRouterKey = process.env.OPENROUTER_API_KEY
if (!apiKey && !groqKey && !openRouterKey) {
  console.warn('[api/debate] No LLM key set — using fallback reasoning')
  return res.status(200).json({
    lines: buildFallbackLines(deputies, results),
    model: 'fallback',
  })
}

const prompt = buildPrompt(deputies, law, results)
let llmText = ''
let modelUsed = ''

// 1) Gemini first (with retries on temporary overload)
if (apiKey) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      // Retry on temporary overload (503/429): the error is transient,
      // a second attempt a few seconds later often succeeds.
      let response
      for (let attempt = 1; attempt <= 3; attempt++) {
        response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7, // higher for varied phrasing; structure still enforced by JSON mode
              maxOutputTokens: 1024,
              responseMimeType: 'application/json',
            },
          }),
        })
        if (response.ok) break
        if ((response.status === 503 || response.status === 429) && attempt < 3) {
          await new Promise((r) => setTimeout(r, 2000 * attempt))
          continue
        }
        const errText = await response.text().catch(() => '')
        throw new Error(`Gemini returned ${response.status}: ${errText.slice(0, 200)}`)
      }
      const json = await response.json()
      llmText = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    } finally {
      clearTimeout(timeout)
    }
    if (!llmText) throw new Error('Empty response from Gemini')
    modelUsed = 'gemini-3.5-flash-lite'
  } catch (geminiErr) {
    console.error('[api/debate] Gemini failed:', geminiErr?.message ?? geminiErr)
    llmText = ''
  }
}

// 2) OpenRouter free router if Gemini failed
if (!llmText && openRouterKey) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      llmText = await callOpenRouter(prompt, openRouterKey, controller.signal)
    } finally {
      clearTimeout(timeout)
    }
    if (!llmText) throw new Error('Empty response from OpenRouter')
    modelUsed = 'openrouter-free'
  } catch (openRouterErr) {
    console.error('[api/debate] OpenRouter failed:', openRouterErr?.message ?? openRouterErr)
    llmText = ''
  }
}

// 3) Groq (gpt-oss-120b) as final backup
if (!llmText && groqKey) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      llmText = await callGroq(prompt, groqKey, controller.signal)
    } finally {
      clearTimeout(timeout)
    }
    if (!llmText) throw new Error('Empty response from Groq')
    modelUsed = 'groq-gpt-oss-120b'
  } catch (groqErr) {
    console.error('[api/debate] Groq failed:', groqErr?.message ?? groqErr)
    llmText = ''
  }
}

// 4) Template fallback if all LLMs failed
if (!llmText) {
  return res.status(200).json({
    lines: buildFallbackLines(deputies, results),
    model: 'fallback',
  })
}

let lines
try {
  lines = parseGeminiResponse(llmText)
} catch (parseErr) {
  console.error('[api/debate] JSON parse failed, using fallback:', parseErr?.message)
  lines = buildFallbackLines(deputies, results)
}

// Ensure every deputy has an entry (fill gaps with fallback)
const lineMap = new Map(lines.map((l) => [l.deputyId, l]))
const fallbackLines = buildFallbackLines(deputies, results)
const merged = fallbackLines.map((fb) => lineMap.get(fb.deputyId) ?? fb)

return res.status(200).json({ lines: merged, model: modelUsed })
}
