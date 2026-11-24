/**
 * Comparison — shows both vote futures side by side:
 *   Left column  : first vote  (original law)
 *   Right column : second vote (amended law)
 *
 * Also shows Stability and Happiness before/after gauges.
 *
 * Task 7.2: Second vote + Comparison component (both futures side by side).
 * Requirement 5.3: show winners/losers, Stability before/after.
 */

import type { RoundResult, GaugeSnapshot } from '../hooks/useDebate.ts'
import type { DeputyResult } from '../hooks/useDebate.ts'

interface Deputy {
  id:     string
  region: string
  title:  string
}

interface Props {
  deputies:     Deputy[]
  firstRound:   RoundResult
  secondRound:  RoundResult
  gaugesBefore: GaugeSnapshot
  gaugesAfter:  GaugeSnapshot
  losingRegion: string   // human-readable name of the amended region
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const VOTE_COLOUR: Record<string, string> = {
  APPROVE: 'var(--bar-high)',
  REJECT:  'var(--bar-low)',
  ABSTAIN: 'var(--text)',
}
const VOTE_BG: Record<string, string> = {
  APPROVE: 'rgba(52,  211, 153, 0.12)',
  REJECT:  'rgba(248, 113, 113, 0.12)',
  ABSTAIN: 'rgba(156, 163, 175, 0.1)',
}

function outcomeLine(counts: RoundResult['counts']): { label: string; colour: string } {
  if (counts.APPROVE > counts.REJECT)  return { label: '✓ Passed',   colour: 'var(--bar-high)' }
  if (counts.APPROVE < counts.REJECT)  return { label: '✗ Rejected', colour: 'var(--bar-low)'  }
  return                                        { label: '– Tied',    colour: 'var(--text)'     }
}

function sign(n: number) { return n >= 0 ? '+' : '' }

// ── Gauge delta card ──────────────────────────────────────────────────────────

function GaugeDeltaCard({
  label,
  before,
  after,
  colour,
}: {
  label:  string
  before: number
  after:  number
  colour: string
}) {
  const delta    = after - before
  const deltaStr = `${sign(delta)}${delta.toFixed(1)}`
  const deltaCol = delta > 0 ? 'var(--bar-high)' : delta < 0 ? 'var(--bar-low)' : 'var(--text)'

  return (
    <div className="comparison__gauge-card">
      <span className="comparison__gauge-label">{label}</span>
      <span className="comparison__gauge-value" style={{ color: colour }}>
        {Math.round(after)}
      </span>
      <span className="comparison__gauge-delta" style={{ color: deltaCol }}>
        {deltaStr} vs before
      </span>
    </div>
  )
}

// ── Vote column ───────────────────────────────────────────────────────────────

function VoteColumn({
  label,
  labelClass,
  round,
  deputies,
  firstResults,
}: {
  label:        string
  labelClass:   string
  round:        RoundResult
  deputies:     Deputy[]
  firstResults?: DeputyResult[]  // only for the second column — to detect changes
}) {
  const resultMap   = new Map(round.results.map((r) => [r.deputyId, r]))
  const firstMap    = firstResults ? new Map(firstResults.map((r) => [r.deputyId, r])) : null
  const { label: outcomeLabel, colour: outcomeColour } = outcomeLine(round.counts)

  return (
    <div className="comparison__col">
      <div className="comparison__col-header">
        <span className={`comparison__col-label ${labelClass}`}>{label}</span>
        <span className="comparison__col-outcome" style={{ color: outcomeColour }}>
          {outcomeLabel}
        </span>
      </div>

      {/* Count row */}
      <div className="comparison__count-row">
        {(['APPROVE', 'ABSTAIN', 'REJECT'] as const).map((v) => (
          <span
            key={v}
            className="comparison__count-pill"
            style={{ color: VOTE_COLOUR[v], background: VOTE_BG[v] }}
          >
            {round.counts[v]} {v}
          </span>
        ))}
      </div>

      {/* Per-deputy rows */}
      {deputies.map((deputy) => {
        const r       = resultMap.get(deputy.id)
        const prev    = firstMap?.get(deputy.id)
        const changed = prev && r && r.vote !== prev.vote
        if (!r) return null
        return (
          <div
            key={deputy.id}
            className={`comparison__row${changed ? ' comparison__row--changed' : ''}`}
            title={changed ? `Changed from ${prev.vote}` : undefined}
          >
            <span className="comparison__row-region">{deputy.region}</span>
            <span className="comparison__row-net">{sign(r.netScore)}{r.netScore.toFixed(1)}</span>
            <span
              className="comparison__row-vote"
              style={{ color: VOTE_COLOUR[r.vote], background: VOTE_BG[r.vote], borderColor: VOTE_COLOUR[r.vote] + '55' }}
            >
              {r.vote}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function Comparison({
  deputies,
  firstRound,
  secondRound,
  gaugesBefore,
  gaugesAfter,
  losingRegion,
}: Props) {
  const secondLoading = secondRound.model === 'pending'

  return (
    <div className="comparison">
      <div className="comparison__header">
        <h3 className="comparison__title">
          Two futures compared
        </h3>
        <span className="sim-badge">Simulated scenario</span>
      </div>

      <p className="comparison__intro">
        The amendment targeted <strong>{losingRegion}</strong>.
        Rows highlighted in teal changed vote between the two rounds.
      </p>

      {/* ── Stability / Happiness before → after ──────────────────── */}
      <div className="comparison__gauges">
        <GaugeDeltaCard
          label="Stability (cohesion)"
          before={gaugesBefore.stability}
          after={gaugesAfter.stability}
          colour="var(--gauge-stability)"
        />
        <GaugeDeltaCard
          label="Happiness (economy)"
          before={gaugesBefore.happiness}
          after={gaugesAfter.happiness}
          colour="var(--gauge-happiness)"
        />
      </div>

      {/* ── Side-by-side vote columns ──────────────────────────────── */}
      <div className="comparison__columns">
        <VoteColumn
          label="First vote"
          labelClass="comparison__col-label--before"
          round={firstRound}
          deputies={deputies}
        />
        <VoteColumn
          label={secondRound.lawTitle}
          labelClass="comparison__col-label--after"
          round={secondRound}
          deputies={deputies}
          firstResults={firstRound.results}
        />
      </div>

      {/* ── Debate speeches for round 2 ────────────────────────────── */}
      {!secondLoading && secondRound.lines.length > 0 && (
        <details className="comparison__debate-detail">
          <summary className="comparison__debate-summary">
            Amended law debate speeches ▾
          </summary>
          <ul className="debate-list comparison__debate-list">
            {deputies.map((deputy) => {
              const r    = new Map(secondRound.results.map((x) => [x.deputyId, x])).get(deputy.id)
              const line = secondRound.lines.find((l) => l.deputyId === deputy.id)
              if (!r || !line) return null
              const VOTE_ICON: Record<string, string> = { APPROVE: '✓', REJECT: '✗', ABSTAIN: '–' }
              return (
                <li key={deputy.id} className="debate-entry" data-vote={r.vote}>
                  <div className="debate-entry__header">
                    <span className="debate-entry__region">
                      {deputy.region}
                      <span className="debate-entry__title">{deputy.title}</span>
                    </span>
                    <span className="debate-entry__vote" style={{ color: VOTE_COLOUR[r.vote] }}>
                      {VOTE_ICON[r.vote]} {r.vote}
                    </span>
                  </div>
                  <p className="debate-entry__reasoning">{line.reasoning}</p>
                  {line.citedFact && (
                    <blockquote className="debate-entry__fact">
                      <span className="debate-entry__fact-text">{line.citedFact}</span>
                      {line.citedSource && (
                        <cite className="debate-entry__fact-source">— {line.citedSource}</cite>
                      )}
                    </blockquote>
                  )}
                </li>
              )
            })}
          </ul>
        </details>
      )}

      <p className="comparison__disclaimer">
        Simulated scenario — not a real economic forecast. All vote outcomes are
        determined by the deterministic engine. The amendment targets the losing
        region's weakest indicator via its strongest sensitivity lever.
      </p>
    </div>
  )
}
