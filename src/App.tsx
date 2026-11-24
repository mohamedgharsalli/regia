import { useState, useEffect, useCallback } from 'react'
import './App.css'
import { deputies as initialDeputies } from './data/deputies.js'
import { laws } from './data/laws.js'
import Chamber3D from './components/Chamber3D.tsx'
import { Dashboard } from './components/Dashboard.tsx'
import { NewsPanel } from './components/NewsPanel.tsx'
import { DebateLog } from './components/DebateLog.tsx'
import { VoteResults } from './components/VoteResults.tsx'
import { AmendmentProposal } from './components/AmendmentProposal.tsx'
import { Comparison } from './components/Comparison.tsx'
import { useNews, applyNewsImpacts } from './hooks/useNews.ts'
import { useDebate } from './hooks/useDebate.ts'

// ── Custom law form ──────────────────────────────────────────────────────────

interface CustomLawForm {
  title: string
  description: string
}

const DEFAULT_FORM: CustomLawForm = {
  title: '', description: '',
}

interface AssessedEffect { indicator: string; delta: number; sensitivity: string }

interface Assessment {
  proposalType: 'law' | 'amendment'
  amendedArticle: string | null
  verdict: 'allow' | 'warn' | 'block' | 'unreviewed'
  flags: string[]
  reason: string
  effects: AssessedEffect[]
}

// The effects of a custom law come only from /api/assess (the AI reads the
// law's text). A real parliament never votes on effect sliders.
function buildCustomLaw(form: CustomLawForm, effects: AssessedEffect[]) {
  return {
    id: 'custom-law',
    title: form.title.trim() || 'Custom law',
    description: form.description.trim() || 'User-proposed law.',
    effects,
  }
}

// ── Deputy detail panel (shown when a 3D seat is clicked) ───────────────────

interface Indicators { economy: number; resources: number; cohesion: number }
interface Deputy {
  id: string; region: string; title: string; issues: string[]
  indicators: Indicators; facts: { text: string; source: string }[]; sensitivity: Record<string, number>
}

function barColour(v: number) {
  return v < 40 ? 'var(--bar-low)' : v < 60 ? 'var(--bar-mid)' : 'var(--bar-high)'
}

function IndicatorBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="indicator-bar">
      <div className="indicator-bar__header">
        <span className="indicator-bar__label">{label}</span>
        <span className="indicator-bar__value">{Math.round(pct)}</span>
      </div>
      <div className="indicator-bar__track" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="indicator-bar__fill" style={{ width: `${pct}%`, background: barColour(pct) }} />
      </div>
    </div>
  )
}

function DeputyDetailPanel({ deputy, isLosing, onClose }: { deputy: Deputy; isLosing: boolean; onClose: () => void }) {
  return (
    <aside className={`deputy-detail${isLosing ? ' deputy-detail--losing' : ''}`} aria-label={`Deputy details: ${deputy.region}`}>
      <div className="deputy-detail__header">
        <div>
          <span className="deputy-detail__region">{deputy.region}</span>
          <span className="deputy-detail__title">{deputy.title}</span>
        </div>
        <button type="button" className="deputy-detail__close" onClick={onClose} aria-label="Close detail panel">✕</button>
      </div>
      <ul className="deputy-detail__issues" aria-label="Key issues">
        {deputy.issues.map(issue => (
          <li key={issue} className="deputy-card__issue">{issue}</li>
        ))}
      </ul>
      <div className="deputy-detail__indicators">
        <IndicatorBar label="Economy"   value={deputy.indicators.economy}   />
        <IndicatorBar label="Resources" value={deputy.indicators.resources} />
        <IndicatorBar label="Cohesion"  value={deputy.indicators.cohesion}  />
      </div>
      {isLosing && (
        <p className="deputy-detail__losing-note">
          ⚑ Losing region — amendment being proposed to address this deputy's concerns.
        </p>
      )}
    </aside>
  )
}

// ── Main App ─────────────────────────────────────────────────────────────────

function App() {
  const [deputies, setDeputies]             = useState(initialDeputies)
  const [selectedLawId, setSelectedLawId]   = useState<string | null>(null)
  const [customForm, setCustomForm]         = useState<CustomLawForm>(DEFAULT_FORM)
  const [customActive, setCustomActive]     = useState(false)
  const [assessment, setAssessment]         = useState<Assessment | null>(null)
  const [assessing, setAssessing]           = useState(false)
  const [selectedDeputyId, setSelectedDeputyId] = useState<string | null>(null)
  const [revealKey, setRevealKey]           = useState(0)

  const { impacts, loading: newsLoading, dataSource, error: newsError, refresh } = useNews()

  const {
    status, firstRound, secondRound, amendment,
    gaugesBefore, gaugesAfter, simulate, amend, reset: resetDebate,
  } = useDebate()

  useEffect(() => {
    setDeputies(impacts.length === 0 ? initialDeputies : applyNewsImpacts(initialDeputies, impacts))
  }, [impacts])

  const handleRefresh = useCallback(() => { refresh(); resetDebate() }, [refresh, resetDebate])

  const handleSelectLaw = useCallback((id: string) => {
    setCustomActive(false)
    setSelectedLawId((prev) => { if (prev === id) { resetDebate(); return null } ; resetDebate(); return id })
  }, [resetDebate])

  const handleSelectCustom = useCallback(() => {
    setSelectedLawId(null); resetDebate(); setAssessment(null); setCustomActive(prev => !prev)
  }, [resetDebate])

  const handleSimulate = useCallback(async () => {
    if (customActive) {
      setAssessing(true)
      setAssessment(null)
      try {
        const res = await fetch('/api/assess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: customForm.title, description: customForm.description }),
        })
        const data = await res.json()
        if (!res.ok || data.verdict === 'unreviewed') {
          setAssessment({ proposalType: 'law', amendedArticle: null, verdict: 'unreviewed', flags: [], reason: data.reason || 'AI review unavailable — please try again.', effects: [] })
          setAssessing(false)
          return
        }
        setAssessment(data)
        simulate(deputies, buildCustomLaw(customForm, data.effects))
      } catch {
        setAssessment({ proposalType: 'law', amendedArticle: null, verdict: 'unreviewed', flags: [], reason: 'AI review unavailable — please try again.', effects: [] })
      }
      setAssessing(false)
      return
    }
    if (!selectedLawId) return
    const law = laws.find(l => l.id === selectedLawId)
    if (law) simulate(deputies, law)
  }, [customActive, customForm, selectedLawId, deputies, simulate])

  const handleAmend = useCallback(() => { amend(deputies) }, [amend, deputies])

  const handleFormChange = useCallback(<K extends keyof CustomLawForm>(key: K, value: CustomLawForm[K]) => {
    if (firstRound) resetDebate()
    setCustomForm(prev => ({ ...prev, [key]: value }))
  }, [firstRound, resetDebate])

  const activeLawId  = customActive ? 'custom-law' : selectedLawId
  const selectedLaw  = customActive ? buildCustomLaw(customForm, assessment?.effects ?? []) : laws.find(l => l.id === selectedLawId) ?? null
  const isSimulating = status === 'simulating' || status === 'fetching' || assessing
  const isAmending   = status === 'amending'
  const hasFirst     = firstRound !== null
  const hasSecond    = secondRound !== null && gaugesBefore !== null && gaugesAfter !== null
  const customFormValid = customForm.title.trim().length > 0
  const canSimulate = customActive ? customFormValid : !!selectedLawId

  // The 3D chamber shows votes once the engine has results
  const chamberRevealed = hasFirst && !!firstRound
  const chamberResults  = firstRound?.results ?? null
  const chamberLosingId = amendment?.losingId ?? null

  const selectedDeputy = deputies.find(d => d.id === selectedDeputyId) as Deputy | undefined

  return (
    <div className="app-shell">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__brand">
            <span className="app-header__logo" aria-hidden="true">⚖</span>
            <h1 className="app-header__title">REGIA</h1>
          </div>
          <p className="app-header__subtitle">Simplified experimental parliament simulator</p>
          <span className="sim-badge">Simulated scenario</span>
        </div>
      </header>

      <main className="app-main">
        {/* ── Dashboard gauges ──────────────────────────────────────────── */}
        <section className="section-gauges" aria-label="Chamber gauges">
          <Dashboard deputies={deputies} />
        </section>

        {/* ── News panel ────────────────────────────────────────────────── */}
        <NewsPanel impacts={impacts} loading={newsLoading} dataSource={dataSource}
          error={newsError} onRefresh={handleRefresh} />

        {/* ── 3D Chamber + detail panel ─────────────────────────────────── */}
        <section className="section-deputies" aria-label="Parliament chamber">
          <h2 className="section-heading">
            Parliament chamber
            <span className="sim-badge sim-badge--inline">Simulated scenario</span>
          </h2>
          <div className="chamber-layout">
            <Chamber3D
              deputies={deputies as Deputy[]}
              results={chamberResults}
              losingId={chamberLosingId}
              selectedId={selectedDeputyId}
              onSelect={id => setSelectedDeputyId(prev => prev === id ? null : id)}
              revealed={chamberRevealed}
              revealKey={revealKey}
              amendmentActive={!!amendment && !hasSecond}
            />
            {selectedDeputy && (
              <DeputyDetailPanel
                deputy={selectedDeputy}
                isLosing={chamberLosingId === selectedDeputy.id}
                onClose={() => setSelectedDeputyId(null)}
              />
            )}
          </div>
          {hasFirst && (
            <div className="law-cta" style={{ marginTop: '10px' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setRevealKey(k => k + 1)}
                style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '13px', fontWeight: 600 }}
              >
                ↺ Replay vote reveal
              </button>
            </div>
          )}
        </section>

        {/* ── Law panel ─────────────────────────────────────────────────── */}
        <section className="section-laws" aria-label="Law proposal">
          <h2 className="section-heading">
            Propose a law
            <span className="sim-badge sim-badge--inline">Simulated scenario</span>
          </h2>
          <div className="law-panel">
            {laws.map(law => (
              <button key={law.id} type="button"
                className={`law-btn${activeLawId === law.id ? ' law-btn--active' : ''}`}
                onClick={() => handleSelectLaw(law.id)}>
                <span className="law-btn__title">{law.title}</span>
                <span className="law-btn__desc">{law.description}</span>
              </button>
            ))}
            <button type="button"
              className={`law-btn law-btn--custom${customActive ? ' law-btn--active' : ''}`}
              onClick={handleSelectCustom}>
              <span className="law-btn__title">✦ Propose your own law</span>
              <span className="law-btn__desc">Write the title and text of your law — the AI estimates its effects from the text, then the parliament votes.</span>
            </button>
          </div>

          {customActive && (
            <div className="custom-law-form" role="form" aria-label="Custom law form">
              <div className="custom-law-form__fields">
                <div className="custom-law-form__field">
                  <label htmlFor="custom-title" className="custom-law-form__label">
                    Law title <span aria-hidden="true" className="custom-law-form__required">*</span>
                  </label>
                  <input id="custom-title" type="text" className="custom-law-form__input"
                    placeholder="e.g. Free public transport" value={customForm.title} maxLength={80}
                    onChange={e => handleFormChange('title', e.target.value)} />
                </div>
                <div className="custom-law-form__field">
                  <label htmlFor="custom-desc" className="custom-law-form__label">Description</label>
                  <textarea id="custom-desc" className="custom-law-form__textarea" rows={2}
                    placeholder="Briefly describe the law's intent and trade-offs."
                    value={customForm.description} maxLength={300}
                    onChange={e => handleFormChange('description', e.target.value)} />
                </div>
              </div>
              <p className="custom-law-form__lever-hint">
                The AI reads your law's text, estimates its effects and flags absurd or harmful content — the parliament then votes on the estimated effects.
              </p>
              {!customFormValid && (
                <p className="custom-law-form__validation" role="alert" aria-live="polite">
                  Add a title before simulating.
                </p>
              )}
            </div>
          )}

          {(activeLawId || customActive) && !hasFirst && (
            <div className="law-cta">
              <button type="button" className="btn-primary"
                onClick={handleSimulate} disabled={isSimulating || !canSimulate} aria-busy={isSimulating}>
                {isSimulating ? 'Simulating…' : 'Simulate vote →'}
              </button>
            </div>
          )}
        </section>

        {/* ── Results area ──────────────────────────────────────────────── */}
        <section className="section-results" aria-label="Vote results">
          <h2 className="section-heading">
            Vote results
            <span className="sim-badge sim-badge--inline">Simulated scenario</span>
          </h2>

          {!hasFirst && !(customActive && assessment && assessment.verdict === 'unreviewed') && (
            <div className="results-placeholder">
              <p className="placeholder-text">
                Select a law above and click <strong>Simulate vote</strong> to see the debate, votes and amendment.
              </p>
            </div>
          )}

          {customActive && assessment && assessment.verdict === 'unreviewed' && !hasFirst && (
            <div className="results-placeholder">
              <p className="placeholder-text">
                ⚠ {assessment.reason} The review is needed to estimate the law's effects.
              </p>
            </div>
          )}

          {customActive && hasFirst && assessment && assessment.verdict !== 'unreviewed' && (
            <div className="law-flag" role="alert" style={{ border: '1px solid var(--border)', borderLeft: `4px solid ${assessment.verdict === 'block' ? '#c0392b' : '#d4a017'}`, padding: '12px 14px', marginBottom: '12px' }}>
              <strong>{assessment.verdict === 'block' ? '⚑ Reality & Ethics Flag' : '⚠ AI review note'}: </strong>
              <span>{assessment.reason}</span>
              {assessment.flags.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                  {assessment.flags.map(f => <li key={f}>{f}</li>)}
                </ul>
              )}
              {assessment.amendedArticle && <p style={{ margin: '6px 0 0' }}>Amended article: {assessment.amendedArticle}</p>}
            </div>
          )}

          {hasFirst && firstRound && selectedLaw && (
            <div className="results-area">
              <VoteResults deputies={deputies} results={firstRound.results}
                counts={firstRound.counts} lawTitle={firstRound.lawTitle} />
              <DebateLog deputies={deputies} results={firstRound.results}
                lines={firstRound.lines} model={firstRound.model} loading={status === 'fetching'} />
              {amendment && !hasSecond && (
                <AmendmentProposal amendment={amendment} deputies={deputies}
                  onApply={handleAmend} loading={isAmending} />
              )}
              {hasSecond && secondRound && gaugesBefore && gaugesAfter && amendment && (
                <Comparison deputies={deputies} firstRound={firstRound} secondRound={secondRound}
                  gaugesBefore={gaugesBefore} gaugesAfter={gaugesAfter} losingRegion={amendment.losingRegion} />
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
