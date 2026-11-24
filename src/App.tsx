import { useState, useEffect, useCallback } from 'react'
import './App.css'
import { deputies as initialDeputies } from './data/deputies.js'
import { laws } from './data/laws.js'
import { DeputyCard } from './components/DeputyCard.tsx'
import { Dashboard } from './components/Dashboard.tsx'
import { NewsPanel } from './components/NewsPanel.tsx'
import { DebateLog } from './components/DebateLog.tsx'
import { VoteResults } from './components/VoteResults.tsx'
import { AmendmentProposal } from './components/AmendmentProposal.tsx'
import { Comparison } from './components/Comparison.tsx'
import { useNews, applyNewsImpacts } from './hooks/useNews.ts'
import { useDebate } from './hooks/useDebate.ts'

function App() {
  const [deputies, setDeputies]           = useState(initialDeputies)
  const [selectedLawId, setSelectedLawId] = useState<string | null>(null)

  const { impacts, loading: newsLoading, dataSource, error: newsError, refresh } = useNews()

  const {
    status,
    firstRound,
    secondRound,
    amendment,
    gaugesBefore,
    gaugesAfter,
    simulate,
    amend,
    reset: resetDebate,
  } = useDebate()

  // Re-derive deputies from baseline whenever news impacts change
  useEffect(() => {
    if (impacts.length === 0) {
      setDeputies(initialDeputies)
    } else {
      setDeputies(applyNewsImpacts(initialDeputies, impacts))
    }
  }, [impacts])

  const handleRefresh = useCallback(() => {
    refresh()
    resetDebate()
  }, [refresh, resetDebate])

  const handleSelectLaw = useCallback((id: string) => {
    setSelectedLawId((prev) => {
      if (prev === id) { resetDebate(); return null }
      resetDebate()
      return id
    })
  }, [resetDebate])

  const handleSimulate = useCallback(() => {
    if (!selectedLawId) return
    const law = laws.find((l) => l.id === selectedLawId)
    if (!law) return
    simulate(deputies, law)
  }, [selectedLawId, deputies, simulate])

  const handleAmend = useCallback(() => {
    amend(deputies)
  }, [amend, deputies])

  const selectedLaw  = laws.find((l) => l.id === selectedLawId) ?? null
  const isSimulating = status === 'simulating' || status === 'fetching'
  const isAmending   = status === 'amending'
  const hasFirst     = firstRound !== null
  const hasSecond    = secondRound !== null && gaugesBefore !== null && gaugesAfter !== null

  return (
    <div className="app-shell">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__brand">
            <span className="app-header__logo" aria-hidden="true">⚖</span>
            <h1 className="app-header__title">REGIA</h1>
          </div>
          <p className="app-header__subtitle">
            Simplified experimental parliament simulator
          </p>
          <span className="sim-badge">Simulated scenario</span>
        </div>
      </header>

      <main className="app-main">
        {/* ── Dashboard gauges ────────────────────────────────────────── */}
        <section className="section-gauges" aria-label="Chamber gauges">
          <Dashboard deputies={deputies} />
        </section>

        {/* ── News panel ──────────────────────────────────────────────── */}
        <NewsPanel
          impacts={impacts}
          loading={newsLoading}
          dataSource={dataSource}
          error={newsError}
          onRefresh={handleRefresh}
        />

        {/* ── Deputy row ──────────────────────────────────────────────── */}
        <section className="section-deputies" aria-label="Deputies">
          <h2 className="section-heading">
            Chamber deputies
            <span className="sim-badge sim-badge--inline">Simulated scenario</span>
          </h2>
          <div className="deputy-row">
            {deputies.map((d) => (
              <DeputyCard
                key={d.id}
                deputy={d}
                highlighted={amendment?.losingId === d.id}
              />
            ))}
          </div>
        </section>

        {/* ── Law panel ───────────────────────────────────────────────── */}
        <section className="section-laws" aria-label="Law proposal">
          <h2 className="section-heading">
            Propose a law
            <span className="sim-badge sim-badge--inline">Simulated scenario</span>
          </h2>
          <div className="law-panel">
            {laws.map((law) => (
              <button
                key={law.id}
                type="button"
                className={`law-btn${selectedLawId === law.id ? ' law-btn--active' : ''}`}
                onClick={() => handleSelectLaw(law.id)}
              >
                <span className="law-btn__title">{law.title}</span>
                <span className="law-btn__desc">{law.description}</span>
              </button>
            ))}
          </div>
          {selectedLawId && !hasFirst && (
            <div className="law-cta">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSimulate}
                disabled={isSimulating}
                aria-busy={isSimulating}
              >
                {isSimulating ? 'Simulating…' : 'Simulate vote →'}
              </button>
            </div>
          )}
        </section>

        {/* ── Results area ────────────────────────────────────────────── */}
        <section className="section-results" aria-label="Vote results">
          <h2 className="section-heading">
            Vote results
            <span className="sim-badge sim-badge--inline">Simulated scenario</span>
          </h2>

          {!hasFirst && (
            <div className="results-placeholder">
              <p className="placeholder-text">
                Select a law above and click <strong>Simulate vote</strong> to see
                the debate, votes and amendment.
              </p>
            </div>
          )}

          {hasFirst && firstRound && selectedLaw && (
            <div className="results-area">

              {/* ── First vote results ──────────────────────────────── */}
              <VoteResults
                deputies={deputies}
                results={firstRound.results}
                counts={firstRound.counts}
                lawTitle={firstRound.lawTitle}
              />

              {/* ── First vote debate log ───────────────────────────── */}
              <DebateLog
                deputies={deputies}
                results={firstRound.results}
                lines={firstRound.lines}
                model={firstRound.model}
                loading={status === 'fetching'}
              />

              {/* ── Amendment proposal (task 7.1) ───────────────────── */}
              {amendment && !hasSecond && (
                <AmendmentProposal
                  amendment={amendment}
                  deputies={deputies}
                  onApply={handleAmend}
                  loading={isAmending}
                />
              )}

              {/* ── Comparison: both futures side by side (task 7.2) ── */}
              {hasSecond && secondRound && gaugesBefore && gaugesAfter && amendment && (
                <Comparison
                  deputies={deputies}
                  firstRound={firstRound}
                  secondRound={secondRound}
                  gaugesBefore={gaugesBefore}
                  gaugesAfter={gaugesAfter}
                  losingRegion={amendment.losingRegion}
                />
              )}

            </div>
          )}
        </section>
      </main>

      <footer className="app-footer">
        <span className="sim-badge">Simulated scenario — not a real parliament</span>
        <span className="app-footer__copy">REGIA · AI Parliament Simulator</span>
      </footer>
    </div>
  )
}

export default App
