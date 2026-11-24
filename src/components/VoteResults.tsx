/**
 * VoteResults — displays the vote tally and each deputy's individual result:
 *   - Total counts: APPROVE / REJECT / ABSTAIN
 *   - Per deputy: vote pill, net score, region name
 *   - "Simulated scenario" badge (Requirement 6.1)
 */

import type { DeputyResult } from '../hooks/useDebate.ts'

interface Deputy {
  id: string
  region: string
  title: string
}

interface Props {
  deputies: Deputy[]
  results:  DeputyResult[]
  counts:   { APPROVE: number; REJECT: number; ABSTAIN: number }
  lawTitle: string
}

const VOTE_COLOUR: Record<string, string> = {
  APPROVE: 'var(--bar-high)',
  REJECT:  'var(--bar-low)',
  ABSTAIN: 'var(--text)',
}

const VOTE_BG: Record<string, string> = {
  APPROVE: 'rgba(52, 211, 153, 0.12)',
  REJECT:  'rgba(248, 113, 113, 0.12)',
  ABSTAIN: 'rgba(156, 163, 175, 0.1)',
}

function TallyBar({ counts }: { counts: Props['counts'] }) {
  const total = counts.APPROVE + counts.REJECT + counts.ABSTAIN || 1

  return (
    <div className="tally-bar" aria-label="Vote tally">
      {counts.APPROVE > 0 && (
        <div
          className="tally-bar__segment"
          style={{ flex: counts.APPROVE / total, background: 'var(--bar-high)' }}
          title={`APPROVE: ${counts.APPROVE}`}
        />
      )}
      {counts.ABSTAIN > 0 && (
        <div
          className="tally-bar__segment"
          style={{ flex: counts.ABSTAIN / total, background: 'var(--gauge-track)', border: '1px solid var(--border)' }}
          title={`ABSTAIN: ${counts.ABSTAIN}`}
        />
      )}
      {counts.REJECT > 0 && (
        <div
          className="tally-bar__segment"
          style={{ flex: counts.REJECT / total, background: 'var(--bar-low)' }}
          title={`REJECT: ${counts.REJECT}`}
        />
      )}
    </div>
  )
}

export function VoteResults({ deputies, results, counts, lawTitle }: Props) {
  const resultMap = new Map(results.map((r) => [r.deputyId, r]))

  const passed = counts.APPROVE > counts.REJECT

  return (
    <div className="vote-results">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="vote-results__header">
        <div className="vote-results__title-row">
          <h3 className="vote-results__title">
            Vote on: <span className="vote-results__law-name">{lawTitle}</span>
          </h3>
          <span className="sim-badge">Simulated scenario</span>
        </div>
        <span
          className="vote-results__outcome"
          style={{ color: passed ? 'var(--bar-high)' : 'var(--bar-low)' }}
          aria-live="polite"
        >
          {passed ? '✓ Law passed' : counts.APPROVE === counts.REJECT ? '– Tied' : '✗ Law rejected'}
        </span>
      </div>

      {/* ── Tally bar ───────────────────────────────────────────── */}
      <TallyBar counts={counts} />

      {/* ── Count pills ─────────────────────────────────────────── */}
      <div className="vote-counts" role="status" aria-label="Vote totals">
        {(['APPROVE', 'ABSTAIN', 'REJECT'] as const).map((v) => (
          <div
            key={v}
            className="vote-count-pill"
            style={{ color: VOTE_COLOUR[v], background: VOTE_BG[v], borderColor: VOTE_COLOUR[v] + '44' }}
          >
            <span className="vote-count-pill__number">{counts[v]}</span>
            <span className="vote-count-pill__label">{v}</span>
          </div>
        ))}
      </div>

      {/* ── Per-deputy breakdown ────────────────────────────────── */}
      <ul className="vote-breakdown" aria-label="Individual votes">
        {deputies.map((deputy) => {
          const r = resultMap.get(deputy.id)
          if (!r) return null
          const sign = r.netScore >= 0 ? '+' : ''

          return (
            <li key={deputy.id} className="vote-row">
              <span className="vote-row__region">
                <span className="vote-row__region-name">{deputy.region}</span>
                <span className="vote-row__region-title">{deputy.title}</span>
              </span>
              <span
                className="vote-row__net"
                aria-label={`Net score: ${sign}${r.netScore.toFixed(2)}`}
              >
                {sign}{r.netScore.toFixed(2)}
              </span>
              <span
                className="vote-row__pill"
                style={{ color: VOTE_COLOUR[r.vote], background: VOTE_BG[r.vote], borderColor: VOTE_COLOUR[r.vote] + '55' }}
                aria-label={`Vote: ${r.vote}`}
              >
                {r.vote}
              </span>
            </li>
          )
        })}
      </ul>

      <p className="vote-results__disclaimer">
        Simulated scenario — not a real economic forecast.
        Votes are determined by the deterministic engine, not by AI.
      </p>
    </div>
  )
}
