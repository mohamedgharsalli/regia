/* Vote colours shared by the 3D chamber and the 2D UI.
 * Kept in its own module so non-3D components never pull in three.js.
 * Vote type is defined here (our engine.js is JS-only, no exported Vote type). */

export type Vote = 'APPROVE' | 'REJECT' | 'ABSTAIN'

export const VOTE_HEX: Record<Vote, string> = {
  APPROVE: '#22c55e',
  REJECT:  '#ef4444',
  ABSTAIN: '#f59e0b',
}
export const NEUTRAL_HEX = '#5b6472'
export const GOLD_HEX    = '#f5c542'
