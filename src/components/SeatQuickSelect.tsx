/* Accessible 2D seat picker — complements (does not replace) the 3D seats.
 * DOM-only: also serves as the WebGL fallback inside Chamber3D.
 * Uses our deputy data shape (not the agon Region type). */

import type { Vote } from '../lib/voteColours'
import { GOLD_HEX, NEUTRAL_HEX, VOTE_HEX } from '../lib/voteColours'

export interface Deputy {
  id: string
  region: string
  title: string
}

export function SeatQuickSelect({
  deputies,
  votes,
  revealed,
  losingId,
  amendmentActive,
  selectedId,
  onSelect,
}: {
  deputies: Deputy[]
  votes: Record<string, Vote> | null
  revealed: boolean
  losingId?: string | null
  amendmentActive?: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div
      role="group"
      aria-label="Select a deputy seat"
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
    >
      {deputies.map((d) => {
        const isGold = amendmentActive && losingId === d.id
        const hex    = isGold ? GOLD_HEX : revealed && votes ? VOTE_HEX[votes[d.id]] : NEUTRAL_HEX
        const active = selectedId === d.id
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onSelect(d.id)}
            aria-pressed={active}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '999px',
              border: active ? '1px solid rgba(255,255,255,0.8)' : '1px solid rgba(255,255,255,0.15)',
              background: active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
              color: active ? '#fff' : '#cbd5e1',
              fontSize: '12px',
              fontWeight: 700,
              padding: '5px 14px',
              cursor: 'pointer',
              transition: 'border-color 0.2s, color 0.2s',
            }}
          >
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: hex, boxShadow: `0 0 8px ${hex}`, flexShrink: 0 }} />
            {d.region}
            {revealed && votes && (
              <span style={{ fontSize: '9px', letterSpacing: '0.1em', opacity: 0.8 }}>
                {isGold ? 'AMENDMENT' : votes[d.id]}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
