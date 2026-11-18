import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList,
} from 'recharts'
import { fmtPct, fmtFull } from '../lib/format'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtMonth = m => { const [y, mo] = m.split('-'); return `${MON[+mo - 1]} '${y.slice(2)}` }

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">{fmtMonth(d.month)}</p>
      <p className="text-slate-500 dark:text-slate-400">
        Connect rate: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{fmtPct(d.connect_pct)}</span>
      </p>
      <p className="text-slate-500 dark:text-slate-400">
        {fmtFull(d.connected)} connected of {fmtFull(d.dialed)} leads
      </p>
      <p className="text-slate-400 dark:text-slate-500">
        Lift via retry: <span className="font-medium text-violet-500 dark:text-violet-400">+{(d.connect_lift_pct ?? 0).toFixed(1)}%</span>
      </p>
    </div>
  )
}

const PctLabel = ({ x, y, value }) => (
  <text x={x} y={y - 10} textAnchor="middle" fontSize={10} fontWeight="600" fill="#6366f1">
    {value.toFixed(1)}%
  </text>
)

export default function MonthlyConnectChart({ data, height = 280 }) {
  const rows = (data || []).map(d => ({ ...d, label: fmtMonth(d.month) }))
  if (rows.length === 0) {
    return <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">No data in the selected range.</div>
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 20, right: 20, bottom: 0, left: 0 }} tabIndex={-1}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={v => v.toFixed(0) + '%'}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          width={44}
          axisLine={false}
          tickLine={false}
          domain={[0, dataMax => Math.min(100, Math.ceil((dataMax + 6) / 10) * 10)]}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }} />
        <Line
          type="monotone"
          dataKey="connect_pct"
          stroke="#6366f1"
          strokeWidth={2.5}
          dot={{ r: 3.5, fill: '#6366f1', strokeWidth: 0 }}
          activeDot={{ r: 5.5, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
        >
          <LabelList dataKey="connect_pct" content={<PctLabel />} />
        </Line>
      </LineChart>
    </ResponsiveContainer>
  )
}
