/**
 * useDebate — coordinates both vote rounds for a single law debate:
 *
 * Round 1 (simulate):
 *   1. Runs the deterministic engine synchronously → DeputyResult[]
 *   2. Identifies the losing region (lowest net score)
 *   3. Builds the amended law object (engine.buildAmendedLaw)
 *   4. POSTs to /api/debate for LLM reasoning (one batched call)
 *
 * Round 2 (amend):
 *   1. Runs the engine on the amended law → DeputyResult[]
 *   2. POSTs to /api/debate for LLM reasoning (second batched call)
 *   3. Computes Stability before/after via applyIndicatorDeltas
 *
 * The vote is ALWAYS determined by the engine. The LLM only writes
 * reasoning text — it cannot change any number or vote.
 */

import { useState, useCallback } from 'react'
import {
  simulateLaw,
  findLosingRegion,
  buildAmendedLaw,
  applyIndicatorDeltas,
  computeStability,
  computeHappiness,
} from '../lib/engine.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface DeputyResult {
  deputyId: string
  netScore: number
  deltaEconomy: number
  deltaResources: number
  deltaCohesion: number
  vote: 'APPROVE' | 'REJECT' | 'ABSTAIN'
}

export interface DebateLine {
  deputyId: string
  reasoning: string
  citedFact: string
  citedSource: string
}

export interface RoundResult {
  results:  DeputyResult[]
  lines:    DebateLine[]
  model:    string
  counts:   { APPROVE: number; REJECT: number; ABSTAIN: number }
  lawTitle: string
}

export interface AmendmentInfo {
  losingId:    string          // deputyId of losing region
  losingRegion: string         // human-readable name
  amendedLaw:  object          // full amended law object (from engine)
  amendEffect: {               // the single new effect added
    indicator:   string
    delta:       number
    sensitivity: string
  }
}

export interface GaugeSnapshot {
  stability:  number
  happiness:  number
}

export type DebateStatus = 'idle' | 'simulating' | 'fetching' | 'amending' | 'done' | 'error'

interface Deputy {
  id: string
  region: string
  title: string
  facts:        { text: string; source: string }[]
  indicators:   { economy: number; resources: number; cohesion: number }
  sensitivity:  Record<string, number>
}

interface LawEffect {
  indicator:   string
  delta:       number
  sensitivity: string
  isAmendment?: boolean
}

interface Law {
  id:          string
  title:       string
  description: string
  effects:     LawEffect[]
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDebate() {
  const [status,        setStatus]        = useState<DebateStatus>('idle')
  const [firstRound,    setFirstRound]    = useState<RoundResult | null>(null)
  const [secondRound,   setSecondRound]   = useState<RoundResult | null>(null)
  const [amendment,     setAmendment]     = useState<AmendmentInfo | null>(null)
  const [gaugesBefore,  setGaugesBefore]  = useState<GaugeSnapshot | null>(null)
  const [gaugesAfter,   setGaugesAfter]   = useState<GaugeSnapshot | null>(null)
  const [error,         setError]         = useState<string | null>(null)

  // ── Round 1: initial simulate ───────────────────────────────────────────
  const simulate = useCallback(async (deputies: Deputy[], law: Law) => {
    setStatus('simulating')
    setError(null)
    setFirstRound(null)
    setSecondRound(null)
    setAmendment(null)
    setGaugesBefore(null)
    setGaugesAfter(null)

    // Snapshot gauges before any law effects
    setGaugesBefore({
      stability:  computeStability(deputies),
      happiness:  computeHappiness(deputies),
    })

    // ── Engine: first vote (synchronous) ─────────────────────────────────
    const results = simulateLaw(deputies, law) as DeputyResult[]
    const counts  = tally(results)

    // Surface vote counts immediately; LLM fills in later
    const partial: RoundResult = { results, lines: [], model: 'pending', counts, lawTitle: law.title }
    setFirstRound(partial)
    setStatus('fetching')

    // ── Identify losing region & build amendment ──────────────────────────
    const losingId    = findLosingRegion(results) as string
    const amendedLaw  = buildAmendedLaw(law, losingId, deputies) as Law
    const amendEffect = (amendedLaw.effects as LawEffect[]).find((e) => e.isAmendment)!
    const losingRegion = deputies.find((d) => d.id === losingId)?.region ?? losingId

    setAmendment({ losingId, losingRegion, amendedLaw, amendEffect })

    // ── LLM: first round reasoning ────────────────────────────────────────
    const { lines, model } = await fetchDebateLines(deputies, law, results)

    setFirstRound({ results, lines, model, counts, lawTitle: law.title })
    setStatus('done')
  }, [])

  // ── Round 2: apply amendment, re-simulate ──────────────────────────────
  const amend = useCallback(async (deputies: Deputy[]) => {
    if (!amendment) return
    const { amendedLaw } = amendment

    setStatus('amending')
    setSecondRound(null)
    setGaugesAfter(null)

    // ── Engine: second vote (synchronous) ────────────────────────────────
    const results2 = simulateLaw(deputies, amendedLaw) as DeputyResult[]
    const counts2  = tally(results2)

    // Compute stability/happiness after applying second-vote deltas
    const updatedDeputies = applyIndicatorDeltas(deputies, results2)
    setGaugesAfter({
      stability:  computeStability(updatedDeputies),
      happiness:  computeHappiness(updatedDeputies),
    })

    // Surface second-vote counts immediately
    setSecondRound({
      results:  results2,
      lines:    [],
      model:    'pending',
      counts:   counts2,
      lawTitle: (amendedLaw as Law).title,
    })

    // ── LLM: second round reasoning ───────────────────────────────────────
    const { lines: lines2, model: model2 } = await fetchDebateLines(deputies, amendedLaw, results2)

    setSecondRound({
      results:  results2,
      lines:    lines2,
      model:    model2,
      counts:   counts2,
      lawTitle: (amendedLaw as Law).title,
    })
    setStatus('done')
  }, [amendment])

  const reset = useCallback(() => {
    setStatus('idle')
    setFirstRound(null)
    setSecondRound(null)
    setAmendment(null)
    setGaugesBefore(null)
    setGaugesAfter(null)
    setError(null)
  }, [])

  return {
    status,
    firstRound,
    secondRound,
    amendment,
    gaugesBefore,
    gaugesAfter,
    error,
    simulate,
    amend,
    reset,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function tally(results: DeputyResult[]) {
  return results.reduce(
    (acc, r) => { acc[r.vote]++; return acc },
    { APPROVE: 0, REJECT: 0, ABSTAIN: 0 },
  )
}

async function fetchDebateLines(
  deputies: Deputy[],
  law: Law,
  results: DeputyResult[],
): Promise<{ lines: DebateLine[]; model: string }> {
  try {
    const res = await fetch('/api/debate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  AbortSignal.timeout(25_000),
      body:    JSON.stringify({ deputies, law, results }),
    })
    if (!res.ok) throw new Error(`/api/debate returned ${res.status}`)
    const json = await res.json() as { lines: DebateLine[]; model: string }
    return { lines: json.lines, model: json.model ?? 'unknown' }
  } catch (err) {
    console.warn('[useDebate] debate API unavailable, using client fallback:', err)
    return { lines: buildClientFallback(deputies, results), model: 'fallback' }
  }
}

// ── Client-side fallback reasoning ───────────────────────────────────────────

const VOTE_OPENERS: Record<string, string[]> = {
  APPROVE: [
    'This law will benefit my region.',
    'I support this measure.',
    'The numbers speak for themselves — I approve.',
  ],
  REJECT: [
    'This law would harm my region.',
    'I cannot support this measure.',
    'The economic impact on my region is too severe to accept.',
  ],
  ABSTAIN: [
    'The effects are too mixed for me to decide.',
    'I find myself caught between the costs and benefits.',
    'I abstain — the trade-offs are real on both sides.',
  ],
}

function buildClientFallback(deputies: Deputy[], results: DeputyResult[]): DebateLine[] {
  const resultMap = new Map(results.map((r) => [r.deputyId, r]))
  return deputies.map((deputy, i) => {
    const r      = resultMap.get(deputy.id)
    const vote   = r?.vote ?? 'ABSTAIN'
    const opener = VOTE_OPENERS[vote][i % VOTE_OPENERS[vote].length]
    const fact   = deputy.facts?.[0]
    return {
      deputyId:    deputy.id,
      reasoning:   `${opener}${fact ? ` ${fact.text}` : ''}`,
      citedFact:   fact?.text   ?? '',
      citedSource: fact?.source ?? '',
    }
  })
}
