import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { fmtPct } from '../lib/format'

const STAGE_LABELS = ['1st call', '+R1', '+R2', '+R3', '+R4', '+R5']

function buildData(g) {
  const cumCounts = [
    g.first_attempt,
    g.first_attempt + g.r1,
    g.first_attempt + g.r1 + g.r2,
    g.first_attempt + g.r1 + g.r2 + g.r3,
    g.first_attempt + g.r1 + g.r2 + g.r3 + g.r4,
    g.connected,
  ]
  return cumCounts.map((count, i) => ({
    stage: STAGE_LABELS[i],
    pct: g.dialed > 0 ? count / g.dialed * 100 : 0,
  }))
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">{label}</p>
      <p className="text-slate-500 dark:text-slate-400">
        Connect rate:{' '}
        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
          {fmtPct(payload[0].value)}
        </span>
      </p>
    </div>
  )
}

export default function CumulativeConnectChart({ g, height = 260 }) {
  const data = buildData(g)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} tabIndex={-1}>
        <defs>
          <linearGradient id="cumConnectGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
          </linearGradient>
        </defs>
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
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
        />
        <Area
          type="monotone"
          dataKey="pct"
          stroke="#6366f1"
          strokeWidth={2.5}
          fill="url(#cumConnectGradient)"
          dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
          activeDot={{ r: 6, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
