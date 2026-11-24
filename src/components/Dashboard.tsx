/**
 * Dashboard — Stability and Happiness gauges using recharts RadialBarChart,
 * plus the mandatory "Simulated scenario" label.
 *
 * Stability  = average cohesion across all deputies
 * Happiness  = average economy across all deputies
 */

import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from 'recharts'
import { computeGauges } from '../lib/engine.js'

interface Indicators {
  economy: number
  resources: number
  cohesion: number
}

interface Deputy {
  id: string
  region: string
  indicators: Indicators
}

interface Props {
  deputies: Deputy[]
}

interface GaugeProps {
  label: string
  value: number
  colour: string
  description: string
}

function Gauge({ label, value, colour, description }: GaugeProps) {
  const pct = Math.round(Math.min(100, Math.max(0, value)))
  const data = [{ value: pct, fill: colour }]

  return (
    <div className="gauge" aria-label={`${label}: ${pct} out of 100`}>
      <div className="gauge__chart">
        <ResponsiveContainer width="100%" height={160}>
          <RadialBarChart
            cx="50%"
            cy="80%"
            innerRadius="60%"
            outerRadius="100%"
            startAngle={180}
            endAngle={0}
            data={data}
          >
            {/* grey background arc — full 100 % */}
            <RadialBar
              dataKey="value"
              cornerRadius={6}
              background={{ fill: 'var(--gauge-track)' }}
              isAnimationActive={true}
            />
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
          </RadialBarChart>
        </ResponsiveContainer>

        {/* numeric readout centred beneath the arc */}
        <div className="gauge__readout" aria-hidden="true">
          <span className="gauge__value" style={{ color: colour }}>
            {pct}
          </span>
          <span className="gauge__unit">/100</span>
        </div>
      </div>

      <div className="gauge__meta">
        <span className="gauge__label">{label}</span>
        <span className="gauge__description">{description}</span>
      </div>
    </div>
  )
}

export function Dashboard({ deputies }: Props) {
  const { stability, happiness } = computeGauges(deputies)

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <h2 className="section-heading">Chamber health</h2>
        <span className="sim-badge">Simulated scenario</span>
      </div>

      <div className="dashboard__gauges">
        <Gauge
          label="Stability"
          value={stability}
          colour="var(--gauge-stability)"
          description="Average cohesion across all regions"
        />
        <Gauge
          label="Happiness"
          value={happiness}
          colour="var(--gauge-happiness)"
          description="Average economic wellbeing across all regions"
        />
      </div>
    </div>
  )
}
