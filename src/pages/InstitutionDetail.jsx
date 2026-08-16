import { useEffect, useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import { ArrowLeft, Loader2, PhoneOutgoing, PhoneCall, TrendingUp, Zap, RefreshCw, Calendar, X } from 'lucide-react'
import KPICard from '../components/KPICard'
import AttemptFunnelChart from '../components/AttemptFunnelChart'
import SortableTable from '../components/SortableTable'
import { fmtNum, fmtPct, fmtFull, connectColor, liftColor } from '../lib/format'
import { institutionLabel } from '../lib/accounts'
import { useFilter } from '../context/FilterContext'
import { computeInstitution, DATE_MIN, DATE_MAX } from '../lib/filterData'

const col = createColumnHelper()

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtDay = iso => { if (!iso) return '—'; const [, m, d] = iso.split('-'); return `${+d} ${MON[+m - 1]}` }

function RetryCell({ v, color = 'text-lime-600' }) {
  if (!v) return <span className="text-slate-300 dark:text-slate-600">—</span>
  return <span className={`font-medium ${color}`}>{fmtFull(v)}</span>
}

const campaignColumns = [
  col.accessor('campaign_id', {
    header: 'Campaign ID',
    cell: info => <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{info.getValue()}</span>,
  }),
  col.accessor('date', {
    header: 'Campaign Date',
    cell: info => {
      const r = info.row.original
      const s = fmtDay(r.date), e = fmtDay(r.date_end)
      return <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{s === e ? s : `${s} – ${e}`}</span>
    },
  }),
  col.accessor('retry_enabled', {
    header: 'Retry',
    cell: info => info.getValue()
      ? <span className="badge bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
          {info.row.original.mode === 'immediate' ? 'Immediate' : 'Scheduled'} ·{info.row.original.configured_retries}
        </span>
      : <span className="badge bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">Off</span>,
  }),
  col.accessor('dialed', {
    header: 'Dialed',
    cell: info => <span className="font-medium">{fmtFull(info.getValue())}</span>,
  }),
  col.accessor('connected', {
    header: 'Connected',
    cell: info => <span className="text-emerald-700 dark:text-emerald-400 font-medium">{fmtFull(info.getValue())}</span>,
  }),
  col.accessor('not_connected', {
    header: 'Not Conn.',
    cell: info => (
      <span className={info.getValue() > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-slate-400'}>
        {fmtFull(info.getValue())}
      </span>
    ),
  }),
  col.accessor('connect_pct', {
    header: 'Connect %',
    cell: info => <span className={`font-semibold ${connectColor(info.getValue())}`}>{fmtPct(info.getValue())}</span>,
  }),
  col.accessor('connect_lift_pct', {
    header: 'Lift %',
    cell: info => <span className={liftColor(info.getValue())}>{info.getValue() ? '+' + info.getValue().toFixed(2) + '%' : '—'}</span>,
  }),
  col.accessor('first_attempt', {
    header: '1st Call',
    cell: info => <span className="text-slate-600 dark:text-slate-400">{fmtFull(info.getValue())}</span>,
  }),
  col.accessor('r1', { header: 'R1', cell: info => <RetryCell v={info.getValue()} /> }),
  col.accessor('r2', { header: 'R2', cell: info => <RetryCell v={info.getValue()} color="text-yellow-600" /> }),
  col.accessor('r3', { header: 'R3', cell: info => <RetryCell v={info.getValue()} color="text-orange-600" /> }),
  col.accessor('r4', { header: 'R4', cell: info => <RetryCell v={info.getValue()} color="text-red-500" /> }),
  col.accessor('r5', { header: 'R5', cell: info => <RetryCell v={info.getValue()} color="text-red-700" /> }),
  col.accessor('next_retry_scheduled', {
    header: 'Next Sched.',
    cell: info => <RetryCell v={info.getValue()} color="text-sky-600" />,
  }),
]

export default function InstitutionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const instId = parseInt(id, 10)
  const { filters } = useFilter()

  const institution = computeInstitution(instId, filters)

  const [campaigns, setCampaigns] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [campFrom, setCampFrom] = useState('')
  const [campTo, setCampTo] = useState('')

  const filteredCampaigns = useMemo(() => {
    if (!campaigns) return campaigns
    if (!campFrom && !campTo) return campaigns
    return campaigns.filter(c => {
      const start = c.date, end = c.date_end || c.date
      if (campFrom && end < campFrom) return false      // campaign ended before range
      if (campTo && start > campTo) return false          // campaign started after range
      return true
    })
  }, [campaigns, campFrom, campTo])

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/data/campaigns/${instId}.json`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => { setCampaigns(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [instId])

  if (!institution) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">Institution <strong>#{id}</strong> not found.</p>
        <button onClick={() => navigate(-1)} className="mt-3 text-sm text-indigo-600 hover:underline">Go back</button>
      </div>
    )
  }

  const inst = institution
  const instName = institutionLabel(instId)

  const isNoAdoption = !inst.retry_enabled
  const effDialed = inst.dialed
  const effFirst  = inst.first_attempt
  const retryTotal = (inst.r1 ?? 0) + (inst.r2 ?? 0) + (inst.r3 ?? 0) + (inst.r4 ?? 0) + (inst.r5 ?? 0)
  const effConnected = inst.connected
  const effNotConn = effDialed - effConnected
  const connectPct = effDialed > 0 ? effConnected / effDialed * 100 : 0
  const firstPct = effDialed > 0 ? effFirst / effDialed * 100 : 0
  const retryPct = effDialed > 0 ? retryTotal / effDialed * 100 : 0
  const liftStr  = isNoAdoption ? '—' : `+${(inst.connect_lift_pct ?? 0).toFixed(1)}%`

  const funnelStats = {
    dialed: effDialed,
    first_attempt: effFirst,
    r1: inst.r1 ?? 0, r2: inst.r2 ?? 0, r3: inst.r3 ?? 0, r4: inst.r4 ?? 0, r5: inst.r5 ?? 0,
    not_connected: effNotConn,
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 mb-5">
        <Link to="/" className="hover:text-slate-600 dark:hover:text-slate-300">Overview</Link>
        <span>/</span>
        <Link to="/institutions" className="hover:text-slate-600 dark:hover:text-slate-300">Institutions</Link>
        <span>/</span>
        <span className="text-slate-700 dark:text-slate-300 font-medium">{instName}</span>
      </nav>

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={16} className="text-slate-500 dark:text-slate-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{instName}</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
            #{instId} &middot; {inst.server} &middot; {inst.campaigns.toLocaleString()} campaigns &middot;{' '}
            {inst.retry_enabled
              ? <span className="text-indigo-600 dark:text-indigo-400 font-medium">{inst.retry_enabled_campaigns} on retry ({inst.dominant_mode})</span>
              : <span className="text-red-500 dark:text-red-400 font-medium">retry not adopted</span>}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KPICard
          label="Unique Leads Dialed"
          value={fmtNum(effDialed)}
          sub={fmtFull(effDialed) + ' leads'}
          icon={PhoneOutgoing}
          iconBg="bg-blue-50 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
        />
        <KPICard
          label="Connected — 1st Call"
          value={fmtPct(firstPct)}
          sub={fmtNum(effFirst) + ' leads'}
          icon={PhoneCall}
          iconBg="bg-emerald-50 dark:bg-emerald-900/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
          valueClass="text-emerald-700 dark:text-emerald-400"
        />
        <KPICard
          label="Connected — via Retry"
          value={fmtPct(retryPct)}
          sub={fmtNum(retryTotal) + ' leads'}
          icon={RefreshCw}
          iconBg="bg-indigo-50 dark:bg-indigo-900/30"
          iconColor="text-indigo-600 dark:text-indigo-400"
          valueClass="text-indigo-700 dark:text-indigo-400"
        />
        <KPICard
          label="Connect Rate"
          value={fmtPct(connectPct)}
          sub={fmtNum(effConnected) + ' connected'}
          icon={TrendingUp}
          iconBg={connectPct >= 60 ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-amber-50 dark:bg-amber-900/30'}
          iconColor={connectPct >= 60 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}
          valueClass={connectColor(connectPct)}
        />
        <KPICard
          label="Connect Lift"
          value={liftStr}
          sub="of dials rescued by retries"
          icon={Zap}
          iconBg="bg-violet-50 dark:bg-violet-900/30"
          iconColor="text-violet-600 dark:text-violet-400"
          valueClass="text-violet-700 dark:text-violet-400"
        />
      </div>

      {/* Attempt Funnel */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Call-Attempt Distribution</h2>
        </div>
        <div className="card-body">
          <AttemptFunnelChart stats={funnelStats} height={90} />
        </div>
      </div>

      {/* Campaign Table */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Campaigns ({(campaigns ? filteredCampaigns.length : inst.campaigns).toLocaleString()})
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Sorted by total dialed descending</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
              <input
                type="date"
                value={campFrom}
                min={DATE_MIN}
                max={campTo || DATE_MAX}
                onChange={e => setCampFrom(e.target.value)}
                className="h-8 px-2 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 [color-scheme:light] dark:[color-scheme:dark]"
              />
              <span className="text-slate-300 dark:text-slate-600 text-xs">→</span>
              <input
                type="date"
                value={campTo}
                min={campFrom || DATE_MIN}
                max={DATE_MAX}
                onChange={e => setCampTo(e.target.value)}
                className="h-8 px-2 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 [color-scheme:light] dark:[color-scheme:dark]"
              />
              {(campFrom || campTo) && (
                <button
                  onClick={() => { setCampFrom(''); setCampTo('') }}
                  title="Clear date filter"
                  className="inline-flex items-center h-8 px-2 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="card-body">
          {loading && (
            <div className="flex items-center gap-2 py-8 justify-center text-sm text-slate-400 dark:text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              Loading campaigns…
            </div>
          )}
          {error && (
            <div className="py-8 text-center text-sm text-red-500">
              Failed to load campaigns: {error}
            </div>
          )}
          {campaigns && (
            <SortableTable
              data={filteredCampaigns}
              columns={campaignColumns}
              globalFilterPlaceholder="Search campaign ID…"
              pageSize={50}
            />
          )}
        </div>
      </div>
    </div>
  )
}
