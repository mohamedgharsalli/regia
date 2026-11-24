/**
 * DebateLog — shows each deputy's spoken reasoning (1–2 sentences)
 * and the dossier fact they cited, with its source.
 *
 * Receives data from /api/debate (or the client-side fallback).
 * Shows a skeleton while the LLM call is in-flight.
 */

import type { DebateLine, DeputyResult } from '../hooks/useDebate.ts'

interface Deputy {
  id: string
  region: string
  title: string
}

interface Props {
  deputies: Deputy[]
  results: DeputyResult[]
  lines: DebateLine[]
  model: string
  loading: boolean   // true while /api/debate is fetching
}

const VOTE_ICON: Record<string, string> = {
  APPROVE: '✓',
  REJECT:  '✗',
  ABSTAIN: '–',
}

const VOTE_COLOUR: Record<string, string> = {
  APPROVE: 'var(--bar-high)',
  REJECT:  'var(--bar-low)',
  ABSTAIN: 'var(--text)',
}

function DeputySkeleton() {
  return (
    <li className="debate-entry debate-entry--skeleton" aria-hidden="true">
      <div className="debate-entry__header">
        <span className="debate-entry__region skeleton-block" style={{ width: '80px', height: '14px' }} />
        <span className="debate-entry__vote skeleton-block" style={{ width: '60px', height: '14px' }} />
      </div>
      <span className="skeleton-block" style={{ width: '100%', height: '13px', marginTop: '8px' }} />
      <span className="skeleton-block" style={{ width: '75%', height: '13px', marginTop: '4px' }} />
      <span className="skeleton-block" style={{ width: '55%', height: '11px', marginTop: '8px' }} />
    </li>
  )
}

export function DebateLog({ deputies, results, lines, model, loading }: Props) {
  const resultMap = new Map(results.map((r) => [r.deputyId, r]))
  const lineMap   = new Map(lines.map((l)  => [l.deputyId,  l]))

  return (
    <div className="debate-log">
      <div className="debate-log__header">
        <h3 className="debate-log__title">Debate</h3>
        {model && model !== 'pending' && (
          <span className="debate-log__model">
            {model === 'fallback' ? '○ Offline mode' : `● ${model}`}
          </span>
        )}
      </div>

      <ul className="debate-list" aria-label="Deputy debate speeches">
        {deputies.map((deputy) => {
          const r    = resultMap.get(deputy.id)
          const line = lineMap.get(deputy.id)

          if (loading && !line) return <DeputySkeleton key={deputy.id} />

          const vote = r?.vote ?? 'ABSTAIN'

          return (
            <li key={deputy.id} className="debate-entry" data-vote={vote}>
              <div className="debate-entry__header">
                <span className="debate-entry__region">
                  {deputy.region}
                  <span className="debate-entry__title">{deputy.title}</span>
                </span>
                <span
                  className="debate-entry__vote"
                  style={{ color: VOTE_COLOUR[vote] }}
                  aria-label={`Vote: ${vote}`}
                >
                  {VOTE_ICON[vote]} {vote}
                </span>
              </div>

              {line ? (
                <>
                  <p className="debate-entry__reasoning">{line.reasoning}</p>
                  {line.citedFact && (
                    <blockquote className="debate-entry__fact">
                      <span className="debate-entry__fact-text">{line.citedFact}</span>
                      {line.citedSource && (
                        <cite className="debate-entry__fact-source">
                          — {line.citedSource}
                        </cite>
                      )}
                    </blockquote>
                  )}
                </>
              ) : (
                <p className="debate-entry__reasoning debate-entry__reasoning--muted">
                  Preparing speech…
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
