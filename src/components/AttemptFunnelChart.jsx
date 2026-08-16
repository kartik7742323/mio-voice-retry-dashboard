import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ATTEMPT_COLORS, ATTEMPT_LABELS, fmtNum, fmtPct } from '../lib/format'

const SEGMENTS = ['first_attempt', 'r1', 'r2', 'r3', 'r4', 'r5', 'not_connected']

function buildData(stats) {
  return [
    SEGMENTS.reduce((acc, key) => {
      acc[key] = stats[key] ?? 0
      return acc
    }, { name: 'Distribution' }),
  ]
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3 text-xs min-w-[180px]">
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: p.fill }} />
            <span className="text-slate-600 dark:text-slate-400">{ATTEMPT_LABELS[p.dataKey]}</span>
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {fmtNum(p.value)} <span className="text-slate-400 dark:text-slate-500 font-normal">({fmtPct(p.value / total * 100)})</span>
          </span>
        </div>
      ))}
    </div>
  )
}

export default function AttemptFunnelChart({ stats, height = 120 }) {
  const data = buildData(stats)

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }} tabIndex={-1}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
          {SEGMENTS.map(key => (
            <Bar key={key} dataKey={key} stackId="a" fill={ATTEMPT_COLORS[key]}
              radius={key === 'first_attempt' ? [4,0,0,4] : key === 'not_connected' ? [0,4,4,0] : [0,0,0,0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {SEGMENTS.map(key => {
          const count = stats[key] ?? 0
          const pct = stats.dialed > 0 ? (count / stats.dialed * 100).toFixed(1) : 0
          return (
            <div key={key} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: ATTEMPT_COLORS[key] }} />
              <span>{ATTEMPT_LABELS[key]}</span>
              <span className="text-slate-400 dark:text-slate-500">({pct}%)</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
