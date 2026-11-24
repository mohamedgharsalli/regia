/**
 * DeputyCard — displays one deputy's region, title, key issues,
 * and three indicator bars (economy, resources, cohesion), each 0–100.
 */

interface Indicators {
  economy: number
  resources: number
  cohesion: number
}

interface Deputy {
  id: string
  region: string
  title: string
  issues: string[]
  indicators: Indicators
  facts: { text: string; source: string }[]
  sensitivity: Record<string, number>
}

interface Props {
  deputy: Deputy
  /** Highlight this card (e.g. it's the losing region being amended) */
  highlighted?: boolean
}

/** Bar colour thresholds: red < 40, amber < 60, green ≥ 60 */
function barColour(value: number): string {
  if (value < 40) return 'var(--bar-low)'
  if (value < 60) return 'var(--bar-mid)'
  return 'var(--bar-high)'
}

const INDICATOR_LABELS: Record<keyof Indicators, string> = {
  economy: 'Economy',
  resources: 'Resources',
  cohesion: 'Cohesion',
}

function IndicatorBar({
  label,
  value,
}: {
  label: string
  value: number
}) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="indicator-bar">
      <div className="indicator-bar__header">
        <span className="indicator-bar__label">{label}</span>
        <span className="indicator-bar__value">{Math.round(pct)}</span>
      </div>
      <div className="indicator-bar__track" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div
          className="indicator-bar__fill"
          style={{ width: `${pct}%`, background: barColour(pct) }}
        />
      </div>
    </div>
  )
}

export function DeputyCard({ deputy, highlighted = false }: Props) {
  const { region, title, issues, indicators } = deputy

  return (
    <article
      className={`deputy-card${highlighted ? ' deputy-card--highlighted' : ''}`}
      data-deputy-id={deputy.id}
    >
      <header className="deputy-card__header">
        <span className="deputy-card__region">{region}</span>
        <span className="deputy-card__title">{title}</span>
      </header>

      <ul className="deputy-card__issues" aria-label="Key issues">
        {issues.map((issue) => (
          <li key={issue} className="deputy-card__issue">
            {issue}
          </li>
        ))}
      </ul>

      <div className="deputy-card__indicators">
        {(Object.keys(INDICATOR_LABELS) as (keyof Indicators)[]).map((key) => (
          <IndicatorBar
            key={key}
            label={INDICATOR_LABELS[key]}
            value={indicators[key]}
          />
        ))}
      </div>
    </article>
  )
}
