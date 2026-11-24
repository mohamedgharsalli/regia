/**
 * AmendmentProposal — appears after the first vote to explain which region
 * lost, what the amendment adds, and to offer the "Run amended vote" button.
 *
 * Task 7.1: Identify losing region after first vote, propose amendment.
 */

import type { AmendmentInfo } from '../hooks/useDebate.ts'

interface Deputy {
  id:     string
  region: string
  title:  string
}

interface Props {
  amendment:  AmendmentInfo
  deputies:   Deputy[]
  onApply:    () => void
  loading:    boolean     // true while round 2 is running
}

const INDICATOR_LABEL: Record<string, string> = {
  economy:   'Economy',
  resources: 'Resources',
  cohesion:  'Cohesion',
}

const SENSITIVITY_LABEL: Record<string, string> = {
  labour:     'labour intensity',
  water:      'water dependency',
  investment: 'investment capacity',
  tax:        'tax sensitivity',
}

export function AmendmentProposal({ amendment, deputies, onApply, loading }: Props) {
  const { losingId, losingRegion, amendEffect } = amendment
  const losingDeputy = deputies.find((d) => d.id === losingId)

  return (
    <div className="amendment-proposal">
      <div className="amendment-proposal__header">
        <span className="amendment-proposal__tag">Amendment proposed</span>
        <span className="sim-badge">Simulated scenario</span>
      </div>

      <div className="amendment-proposal__body">
        <p className="amendment-proposal__summary">
          <strong>{losingRegion}</strong>
          {losingDeputy ? ` (${losingDeputy.title})` : ''} had the lowest net score
          in the first vote. The amendment adds targeted support to rescue this region.
        </p>

        <div className="amendment-effect">
          <span className="amendment-effect__label">Amendment effect</span>
          <div className="amendment-effect__detail">
            <span className="amendment-effect__indicator">
              {INDICATOR_LABEL[amendEffect.indicator] ?? amendEffect.indicator}
            </span>
            <span className="amendment-effect__delta">
              +{amendEffect.delta} pts
            </span>
            <span className="amendment-effect__lever">
              via {SENSITIVITY_LABEL[amendEffect.sensitivity] ?? amendEffect.sensitivity}
            </span>
          </div>
          <p className="amendment-effect__note">
            This effect applies to all deputies through their{' '}
            <strong>{amendEffect.sensitivity}</strong> sensitivity multiplier,
            with the greatest benefit to {losingRegion} which has the highest
            sensitivity for this lever.
          </p>
        </div>
      </div>

      <div className="amendment-proposal__cta">
        <button
          type="button"
          className="btn-primary"
          onClick={onApply}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? 'Simulating amended vote…' : 'Run amended vote →'}
        </button>
      </div>
    </div>
  )
}
