/**
 * NewsPanel — shows up to 3 current news impacts, each with:
 *   - headline (linked to source)
 *   - region tag
 *   - indicator + delta badge
 *   - source name
 *
 * Displays a "Simulated scenario" badge and a "Live / Cached" data-source label.
 * Provides a Refresh button that triggers the useNews hook.
 */

import type { NewsImpact, NewsSource } from '../hooks/useNews.ts'

interface Props {
  impacts: NewsImpact[]
  loading: boolean
  dataSource: NewsSource
  error: string | null
  onRefresh: () => void
}

const INDICATOR_LABEL: Record<string, string> = {
  economy:   'Economy',
  resources: 'Resources',
  cohesion:  'Cohesion',
}

const REGION_LABEL: Record<string, string> = {
  tunis:        'Tunis',
  'sidi-bouzid':'Sidi Bouzid',
  gafsa:        'Gafsa',
  sfax:         'Sfax',
  kasserine:    'Kasserine',
  global:       'All regions',
}

function DeltaBadge({ delta, indicator }: { delta: number; indicator: string }) {
  const sign   = delta >= 0 ? '+' : ''
  const colour = delta >= 0 ? 'var(--bar-high)' : 'var(--bar-low)'
  return (
    <span className="news-delta" style={{ color: colour }}>
      {sign}{delta} {INDICATOR_LABEL[indicator] ?? indicator}
    </span>
  )
}

function SourceTag({ source }: { source: NewsSource }) {
  if (source === 'idle') return null
  const label  = source === 'live' ? 'Live feed' : 'Cached headlines'
  const colour = source === 'live' ? 'var(--regia-teal)' : 'var(--badge-text)'
  return (
    <span className="news-source-tag" style={{ color: colour }}>
      {source === 'live' ? '● ' : '○ '}{label}
    </span>
  )
}

export function NewsPanel({ impacts, loading, dataSource, error, onRefresh }: Props) {
  const isEmpty = !loading && impacts.length === 0

  return (
    <section className="news-panel" aria-label="News impacts">
      <div className="news-panel__header">
        <div className="news-panel__title-row">
          <h2 className="section-heading">
            Regional &amp; world news
            <span className="sim-badge sim-badge--inline">Simulated scenario</span>
          </h2>
          <SourceTag source={dataSource} />
        </div>
        <button
          type="button"
          className="btn-refresh"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh news"
        >
          {loading ? 'Fetching…' : '↻ Refresh news'}
        </button>
      </div>

      {error && (
        <p className="news-panel__error" role="alert">
          Feed unavailable — showing cached headlines.
        </p>
      )}

      {isEmpty && !error && (
        <p className="news-panel__empty">
          Click <strong>Refresh news</strong> to load the latest regional headlines and apply their impacts.
        </p>
      )}

      {impacts.length > 0 && (
        <ul className="news-list" aria-label="News impacts applied">
          {impacts.map((item, i) => (
            <li key={`${item.region}-${i}`} className="news-item">
              <div className="news-item__meta">
                <span className="news-item__region">
                  {REGION_LABEL[item.region] ?? item.region}
                </span>
                <DeltaBadge delta={item.delta} indicator={item.indicator} />
              </div>
              <a
                href={item.link || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="news-item__headline"
              >
                {item.headline}
              </a>
              <div className="news-item__footer">
                <span className="news-item__source">{item.source}</span>
                {item.date && (
                  <span className="news-item__date">{item.date}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
