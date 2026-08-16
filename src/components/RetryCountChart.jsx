import {
  BarChart, Bar, XAxis, YAxis, Tooltip, LabelList,
  ResponsiveContainer, Cell,
} from 'recharts'
import { fmtFull } from '../lib/format'

const COLORS = ['#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5']

function buildData(dist) {
  return [1, 2, 3, 4, 5].map((n, i) => ({
    label: `${n} ${n === 1 ? 'retry' : 'retries'}`,
    count: dist?.[n] ?? dist?.[String(n)] ?? 0,
    color: COLORS[i],
  }))
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2.5 text-xs">
      <p className="font-semibold text-slate-800 dark:text-slate-200">{label}</p>
      <p className="text-slate-500 dark:text-slate-400">
        Campaigns: <span className="font-semibold text-slate-800 dark:text-slate-100">{fmtFull(payload[0].value)}</span>
      </p>
    </div>
  )
}

export default function RetryCountChart({ dist, height = 200 }) {
  const data = buildData(dist)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 0 }} tabIndex={-1}>
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={36} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={52}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          <LabelList dataKey="count" position="top" fontSize={11} fill="#94a3b8" fontWeight="600" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
