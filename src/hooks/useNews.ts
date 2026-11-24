/**
 * useNews — fetches news impacts from /api/news for all 5 regions,
 * returns the top MAX_IMPACTS items (sorted by |delta| descending),
 * and provides an applyNews function that patches a deputies array.
 *
 * Falls back to the imported cachedNews array if the API call fails
 * (network down, dev mode without a Vercel runtime, etc.).
 */

import { useState, useCallback } from 'react'
import { cachedNews } from '../data/news-fallback.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface NewsImpact {
  region: string
  indicator: 'economy' | 'resources' | 'cohesion'
  delta: number
  headline: string
  source: string
  link: string
  date: string
}

interface Deputy {
  id: string
  indicators: { economy: number; resources: number; cohesion: number }
  [key: string]: unknown
}

export type NewsSource = 'live' | 'fallback' | 'idle'

export interface NewsState {
  impacts: NewsImpact[]
  loading: boolean
  dataSource: NewsSource
  error: string | null
}

// ── Constants ────────────────────────────────────────────────────────────────

const REGION_IDS = ['tunis', 'sidi-bouzid', 'gafsa', 'sfax', 'kasserine'] as const
const MAX_IMPACTS = 3
const API_BASE    = '/api/news'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Clamp an indicator value to [0, 100] */
function clamp(v: number): number {
  return Math.min(100, Math.max(0, v))
}

/**
 * Apply a list of NewsImpacts to a deputies array.
 * Returns a NEW array; originals are not mutated.
 */
export function applyNewsImpacts(
  deputies: Deputy[],
  impacts: NewsImpact[],
): Deputy[] {
  return deputies.map((deputy) => {
    const relevant = impacts.filter((imp) => imp.region === deputy.id)
    if (!relevant.length) return deputy

    const patch = { ...deputy.indicators }
    for (const imp of relevant) {
      patch[imp.indicator] = clamp(patch[imp.indicator] + imp.delta)
    }

    return { ...deputy, indicators: patch }
  })
}

/**
 * Fetch impacts for one region from /api/news.
 * Returns null on any error so callers can fall back.
 */
async function fetchRegionNews(region: string): Promise<NewsImpact[] | null> {
  try {
    const url = `${API_BASE}?region=${encodeURIComponent(region)}&max=${MAX_IMPACTS}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const json = await res.json() as { items: NewsImpact[]; source: string }
    return Array.isArray(json.items) ? json.items : null
  } catch {
    return null
  }
}

/**
 * Build a fallback impact list from the static cache.
 * Picks up to MAX_IMPACTS items distributed across regions.
 */
function buildFallbackImpacts(): NewsImpact[] {
  // Take the first item from each region, then pad to MAX_IMPACTS from remaining
  const byRegion = new Map<string, NewsImpact[]>()
  for (const item of cachedNews as NewsImpact[]) {
    if (!byRegion.has(item.region)) byRegion.set(item.region, [])
    byRegion.get(item.region)!.push(item)
  }

  const pool: NewsImpact[] = []
  for (const items of byRegion.values()) {
    if (items[0]) pool.push(items[0])
  }
  // Sort by absolute delta descending and cap
  pool.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  return pool.slice(0, MAX_IMPACTS)
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useNews() {
  const [state, setState] = useState<NewsState>({
    impacts:    [],
    loading:    false,
    dataSource: 'idle',
    error:      null,
  })

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))

    try {
      // Fetch all regions in parallel; individual failures return null
      const results = await Promise.all(
        REGION_IDS.map((id) => fetchRegionNews(id)),
      )

      const anyLive = results.some((r) => r !== null)

      let allImpacts: NewsImpact[]
      let dataSource: NewsSource

      if (anyLive) {
        // Merge live results; use fallback for any region that failed
        const fallbackByRegion = new Map<string, NewsImpact[]>()
        for (const item of cachedNews as NewsImpact[]) {
          if (!fallbackByRegion.has(item.region)) fallbackByRegion.set(item.region, [])
          fallbackByRegion.get(item.region)!.push(item)
        }

        allImpacts = REGION_IDS.flatMap((id, i) => {
          const live = results[i]
          if (live && live.length) return live
          return fallbackByRegion.get(id)?.slice(0, 1) ?? []
        })
        dataSource = 'live'
      } else {
        // All fetches failed — full static fallback
        allImpacts = buildFallbackImpacts()
        dataSource = 'fallback'
      }

      // Sort by |delta| descending, pick top MAX_IMPACTS
      allImpacts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      const topImpacts = allImpacts.slice(0, MAX_IMPACTS)

      setState({ impacts: topImpacts, loading: false, dataSource, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setState({
        impacts:    buildFallbackImpacts(),
        loading:    false,
        dataSource: 'fallback',
        error:      message,
      })
    }
  }, [])

  return { ...state, refresh }
}
