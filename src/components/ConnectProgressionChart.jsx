import {
  BarChart, Bar, XAxis, YAxis, Tooltip, LabelList,
  ResponsiveContainer, Cell,
} from 'recharts'
import { fmtPct } from '../lib/format'

const STAGE_LABELS = ['1st call', '+R1', '+R2', '+R3', '+R4', '+R5']
const STAGE_COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444', '#dc2626']

function buildData(g) {
  const cumCounts = [
    g.first_attempt,
    g.first_attempt + g.r1,
    g.first_attempt + g.r1 + g.r2,
    g.first_attempt + g.r1 + g.r2 + g.r3,
    g.first_attempt + g.r1 + g.r2 + g.r3 + g.r4,
    g.connected,
  ]
  return cumCounts.map((count, i) => {
    const pct = g.dialed > 0 ? count / g.dialed * 100 : 0
    const prevPct = i === 0 ? 0 : (g.dialed > 0 ? cumCounts[i - 1] / g.dialed * 100 : 0)
    return { stage: STAGE_LABELS[i], pct, gain: pct - prevPct }
  })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">{label}</p>
      <p className="text-slate-500 dark:text-slate-400">
        Cumulative connect: <span className="font-semibold text-slate-800 dark:text-slate-100">{fmtPct(d.pct)}</span>
      </p>
      <p className="text-slate-500 dark:text-slate-400">
        Gain: <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{d.gain.toFixed(3)}pp</span>
      </p>
    </div>
  )
}

function GainLabel({ x, y, width, value }) {
  if (value == null || value < 0.0001) return null
  const small = width < 40
  return (
    <text
      x={x + width / 2}
      y={y - 4}
      textAnchor="middle"
      fontSize={small ? 8 : 10}
      fontWeight="600"
      fill="#94a3b8"
    >
      +{value.toFixed(small ? 1 : 2)}pp
    </text>
  )
}

export default function ConnectProgressionChart({ g, height = 260 }) {
  const data = buildData(g)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 24, right: 8, bottom: 0, left: 0 }} tabIndex={-1}>
        <XAxis
          dataKey="stage"
          tick={{ fontSize: 12, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={v => v.toFixed(1) + '%'}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          width={48}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
        <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={56}>
          {data.map((_, i) => (
            <Cell key={i} fill={STAGE_COLORS[i]} />
          ))}
          <LabelList dataKey="gain" content={<GainLabel />} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
