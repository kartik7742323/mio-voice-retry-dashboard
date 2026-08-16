import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { fmtFull } from '../lib/format'

/**
 * Reusable donut. `segments` = [{ label, value, color }].
 * `centerValue` / `centerLabel` render in the hole.
 */
export default function Donut({ segments, centerValue, centerLabel, height = 180 }) {
  const total = segments.reduce((s, x) => s + x.value, 0)

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    const pct = total > 0 ? (d.value / total * 100).toFixed(1) : 0
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2.5 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
          <span className="text-slate-600 dark:text-slate-400">{d.label}</span>
        </span>
        <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
          {fmtFull(d.value)} <span className="text-slate-400 font-normal">({pct}%)</span>
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={segments}
            dataKey="value"
            nameKey="label"
            innerRadius="62%"
            outerRadius="90%"
            paddingAngle={2}
            stroke="none"
          >
            {segments.map((s, i) => <Cell key={i} fill={s.color} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {centerValue != null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-none">{centerValue}</span>
          {centerLabel && <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wide">{centerLabel}</span>}
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span>{s.label}</span>
            <span className="text-slate-400 dark:text-slate-500 font-medium">{fmtFull(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
