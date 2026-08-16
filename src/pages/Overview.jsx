import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import {
  PhoneOutgoing, PhoneCall, XCircle, TrendingUp, Zap, RefreshCw, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown, Minus, Download, Building2, Layers, Users, FlaskConical,
} from 'lucide-react'
import KPICard from '../components/KPICard'
import SortableTable from '../components/SortableTable'
import ConnectProgressionChart from '../components/ConnectProgressionChart'
import CumulativeConnectChart from '../components/CumulativeConnectChart'
import Donut from '../components/Donut'
import RetryCountChart from '../components/RetryCountChart'
import { fmtNum, fmtPct, fmtFull, connectColor, formatDate, MODE_COLORS } from '../lib/format'
import { institutionLabel } from '../lib/accounts'
import { downloadPeriodComparison, downloadNoAdoptionRisk } from '../lib/download'

const col = createColumnHelper()
const noRiskColumns = [
  col.accessor('name', {
    header: 'Institution',
    cell: info => (
      <div>
        <p className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[260px]">{info.getValue()}</p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500">#{info.row.original.institution_id} · {info.row.original.server}</p>
      </div>
    ),
  }),
  col.accessor('first_attempt_raw', {
    header: 'Connected — 1st call',
    cell: info => (
      <span className="font-semibold text-emerald-700 dark:text-emerald-400">{fmtFull(info.getValue())}</span>
    ),
  }),
  col.accessor('dialed_raw', {
    header: 'Total Dialed',
    cell: info => <span className="text-slate-600 dark:text-slate-400">{fmtFull(info.getValue())}</span>,
  }),
  col.accessor('campaigns', {
    header: 'Campaigns',
    cell: info => <span className="text-slate-600 dark:text-slate-400">{fmtFull(info.getValue())}</span>,
  }),
]

const BUCKETS = [
  { key: '100k+',    label: '100k+',    min: 100_000, max: Infinity },
  { key: '25k–100k', label: '25k–100k', min: 25_000,  max: 100_000 },
  { key: 'Below 25k',label: 'Below 25k',min: 0,       max: 25_000  },
]

function SyntheticBanner() {
  return (
    <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-amber-300/60 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-900/15 px-4 py-3">
      <FlaskConical size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
        <span className="font-semibold">Synthetic demo data.</span> These numbers are fabricated so the dashboard is demoable.
        Replace with real data via <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-800/40 font-mono text-[11px]">scripts/process.py</code> once the fields in <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-800/40 font-mono text-[11px]">DATA_SPEC.md</code> are available.
      </p>
    </div>
  )
}

function AdoptionTile({ icon: Icon, label, value, total, pct, tone = 'indigo' }) {
  const tones = {
    indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30',
    sky:    'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30',
    violet: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30',
  }
  const barTone = { indigo: 'bg-indigo-500', sky: 'bg-sky-500', violet: 'bg-violet-500' }
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tones[tone]}`}>
          <Icon size={16} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
          {fmtPct(pct)}
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{fmtFull(value)} of {fmtFull(total)}</p>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full ${barTone[tone]}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  )
}

export default function Overview({ data }) {
  const navigate = useNavigate()
  const g = data.global
  const a = data.adoption
  const institutions = data.by_institution

  const [minDialed, setMinDialed] = useState(1000)
  const adopters = institutions.filter(i => i.retry_enabled && i.dialed > 0)
  // rank by connect % descending (highest first); break ties by larger dialed volume
  const top10 = [...adopters]
    .filter(i => i.dialed >= (Number(minDialed) || 0))
    .sort((x, y) => (y.connect_pct ?? 0) - (x.connect_pct ?? 0) || (y.dialed ?? 0) - (x.dialed ?? 0))
    .slice(0, 10)

  const retryTotal = g.r1 + g.r2 + g.r3 + g.r4 + g.r5
  const firstPct = g.dialed > 0 ? g.first_attempt / g.dialed * 100 : 0
  const retryPct = g.dialed > 0 ? retryTotal / g.dialed * 100 : 0
  const liftStr  = g.connect_lift_pct != null ? `+${g.connect_lift_pct.toFixed(1)}%` : '—'

  const instAdoptPct = a.voice_institutions > 0 ? a.retry_institutions / a.voice_institutions * 100 : 0
  const campAdoptPct = a.voice_campaigns > 0 ? a.retry_campaigns / a.voice_campaigns * 100 : 0
  const dialedAdoptPct = a.dialed_total > 0 ? a.dialed_retry / a.dialed_total * 100 : 0

  const modeSegments = [
    { label: 'Immediate', value: a.mode_immediate, color: MODE_COLORS.immediate },
    { label: 'Scheduled', value: a.mode_scheduled, color: MODE_COLORS.schedule },
  ]
  // retry_mode isn't available in the source data yet → hide the mode-split donut
  const hasModeData = (a.mode_immediate + a.mode_scheduled) > 0

  // KPI scroll
  const kpiRef = useRef(null)
  const [kpiAtStart, setKpiAtStart] = useState(true)
  const [kpiAtEnd,   setKpiAtEnd]   = useState(false)

  useEffect(() => {
    const el = kpiRef.current
    if (!el) return
    const check = () => {
      setKpiAtStart(el.scrollLeft <= 2)
      setKpiAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2)
    }
    check()
    el.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => {
      el.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [])

  const scrollKPI = (dir) => kpiRef.current?.scrollBy({ left: dir * 260, behavior: 'smooth' })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Mio AI Voice — Retry Overview</h1>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
          {fmtFull(a.voice_institutions)} voice institutions &middot; {fmtFull(a.voice_campaigns)} campaigns &middot; extracted {formatDate(data.extracted_date)}
        </p>
      </div>

      {data.synthetic && <SyntheticBanner />}

      {/* ── Connect Rate & Retry Lift ────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={16} className="text-emerald-500" />
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Connect Rate &amp; Retry Lift</h2>
      </div>

      <div className="relative mb-3">
        {!kpiAtStart && (
          <button
            onClick={() => scrollKPI(-1)}
            className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-md flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
        )}

        <div
          ref={kpiRef}
          className="flex gap-4 overflow-x-auto scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="shrink-0 w-44 sm:w-52 lg:w-[calc(20%-0.8rem)]">
            <KPICard
              label="Unique Leads Dialed"
              value={fmtNum(g.dialed)}
              sub={`${fmtFull(g.dialed)} leads`}
              icon={PhoneOutgoing}
              iconBg="bg-blue-50 dark:bg-blue-900/30"
              iconColor="text-blue-600 dark:text-blue-400"
            />
          </div>
          <div className="shrink-0 w-44 sm:w-52 lg:w-[calc(20%-0.8rem)]">
            <KPICard
              label="Connected — 1st Call"
              value={fmtPct(firstPct)}
              sub={fmtNum(g.first_attempt) + ' leads'}
              icon={PhoneCall}
              iconBg="bg-emerald-50 dark:bg-emerald-900/30"
              iconColor="text-emerald-600 dark:text-emerald-400"
              valueClass="text-emerald-700 dark:text-emerald-400"
            />
          </div>
          <div className="shrink-0 w-44 sm:w-52 lg:w-[calc(20%-0.8rem)]">
            <KPICard
              label="Connected — via Retry"
              value={fmtPct(retryPct)}
              sub={fmtNum(retryTotal) + ' leads'}
              icon={RefreshCw}
              iconBg="bg-indigo-50 dark:bg-indigo-900/30"
              iconColor="text-indigo-600 dark:text-indigo-400"
              valueClass="text-indigo-700 dark:text-indigo-400"
            />
          </div>
          <div className="shrink-0 w-44 sm:w-52 lg:w-[calc(20%-0.8rem)]">
            <KPICard
              label="Connect Rate"
              value={fmtPct(g.connect_pct)}
              sub={fmtNum(g.connected) + ' connected'}
              icon={TrendingUp}
              iconBg={g.connect_pct >= 60 ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-amber-50 dark:bg-amber-900/30'}
              iconColor={g.connect_pct >= 60 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}
              valueClass={connectColor(g.connect_pct)}
            />
          </div>
          <div className="shrink-0 w-44 sm:w-52 lg:w-[calc(20%-0.8rem)]">
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
          <div className="shrink-0 w-44 sm:w-52 lg:w-[calc(20%-0.8rem)]">
            <KPICard
              label="Not Connected"
              value={fmtNum(g.not_connected)}
              sub={fmtFull(g.retry_exhausted) + ' retry-exhausted'}
              icon={XCircle}
              iconBg="bg-red-50 dark:bg-red-900/30"
              iconColor="text-red-500 dark:text-red-400"
              valueClass="text-red-600 dark:text-red-400"
            />
          </div>
        </div>

        {!kpiAtEnd && (
          <button
            onClick={() => scrollKPI(1)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-md flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-400 dark:text-slate-500 italic mb-6 px-1">
        Lead-wise metrics — each unique lead counts once, and connects if it answered on any attempt (1st call or a retry).
        “Connect Lift” = share of leads that first connected on a retry rather than the first call.
      </p>

      {/* ── Feature Adoption ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        <Users size={16} className="text-indigo-500" />
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Feature Adoption</h2>
        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 normal-case tracking-normal">· configuration snapshot (College-scoped)</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <AdoptionTile icon={Building2} label="Institutes on Retry" value={a.retry_institutions} total={a.voice_institutions} pct={instAdoptPct} tone="indigo" />
        <AdoptionTile icon={Layers}    label="Campaigns on Retry"  value={a.retry_campaigns}    total={a.voice_campaigns}    pct={campAdoptPct} tone="sky" />
        <AdoptionTile icon={PhoneOutgoing} label="Leads Dialed via Retry" value={a.dialed_retry} total={a.dialed_total} pct={dialedAdoptPct} tone="violet" />
      </div>

      <div className={`grid grid-cols-1 ${hasModeData ? 'lg:grid-cols-2' : ''} gap-6 mb-8`}>
        {hasModeData && (
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Retry Mode Split</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Immediate vs Scheduled across retry-enabled campaigns</p>
            </div>
            <div className="card-body">
              <Donut
                segments={modeSegments}
                centerValue={fmtNum(a.retry_campaigns)}
                centerLabel="campaigns"
                height={200}
              />
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Configured Retry Count</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">How many retries institutes configure per campaign (max 5)</p>
          </div>
          <div className="card-body">
            <RetryCountChart dist={a.retry_count_dist} height={220} />
          </div>
        </div>
      </div>

      {/* Period Comparison */}
      {data.periods?.length >= 2 && (
        <PeriodComparison periods={data.periods} extractedDate={data.extracted_date} />
      )}

      {/* Connect progression charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-7">
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Connect Rate Progression</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Cumulative connect % after each retry wave with incremental gain</p>
          </div>
          <div className="card-body">
            <ConnectProgressionChart g={g} height={260} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Cumulative Connect Rate</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">How connect rate accumulates across retry waves</p>
          </div>
          <div className="card-body">
            <CumulativeConnectChart g={g} height={260} />
          </div>
        </div>
      </div>

      {/* No Adoption Risk */}
      <NoAdoptionRiskTable institutions={institutions} navigate={navigate} extractedDate={data.extracted_date} />

      {/* Top 10 */}
      <InstitutionRankTable
        title="Top 10 Adopters by Connect Rate"
        rows={top10}
        navigate={navigate}
        headerRight={
          <div className="flex items-center gap-2">
            <label htmlFor="minDialed" className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Min unique leads dialed
            </label>
            <input
              id="minDialed"
              type="number"
              min="0"
              step="100"
              value={minDialed}
              onChange={e => setMinDialed(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-24 h-8 px-2 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
            />
          </div>
        }
      />
    </div>
  )
}

function DeltaBadge({ a, b, unit = 'pp', higherIsBetter = true }) {
  if (a == null || b == null) return <span className="text-slate-400 text-xs">—</span>
  const diff = b - a
  if (Math.abs(diff) < 0.005) {
    return (
      <span className="inline-flex items-center justify-end gap-0.5 text-xs text-slate-400">
        <Minus size={11} />0pp
      </span>
    )
  }
  const positive = diff > 0
  const good = higherIsBetter ? positive : !positive
  const color = good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
  const Icon = positive ? ArrowUp : ArrowDown
  return (
    <span className={`inline-flex items-center justify-end gap-0.5 text-xs font-semibold ${color}`}>
      <Icon size={11} />{positive ? '+' : ''}{diff.toFixed(2)}{unit}
    </span>
  )
}

const PERIOD_COL_COLORS = [
  'text-blue-500 dark:text-blue-400',
  'text-violet-500 dark:text-violet-400',
  'text-emerald-500 dark:text-emerald-400',
]

function PeriodComparison({ periods, extractedDate }) {
  const pglobals = periods.map(p => {
    const g = p.global
    const retry = g.r1 + g.r2 + g.r3 + g.r4 + g.r5
    return {
      ...g,
      retryPct: g.dialed > 0 ? retry / g.dialed * 100 : 0,
      firstPct: g.dialed > 0 ? g.first_attempt / g.dialed * 100 : 0,
      missPct:  g.dialed > 0 ? g.not_connected / g.dialed * 100 : 0,
    }
  })

  const prev = pglobals[pglobals.length - 2]
  const last = pglobals[pglobals.length - 1]

  const rows = [
    { label: 'Leads Dialed',           vals: pglobals.map(g => fmtFull(g.dialed)),               a: null,                    b: null },
    { label: 'Connect Rate %',         vals: pglobals.map(g => fmtPct(g.connect_pct)),           a: prev.connect_pct,        b: last.connect_pct,        hib: true  },
    { label: 'Connect Lift',           vals: pglobals.map(g => fmtPct(g.connect_lift_pct)),      a: prev.connect_lift_pct,   b: last.connect_lift_pct,   hib: true  },
    { label: 'Connected — 1st call',   vals: pglobals.map(g => fmtPct(g.firstPct)),              a: prev.firstPct,           b: last.firstPct,           hib: true  },
    { label: 'Connected — via retry',  vals: pglobals.map(g => fmtPct(g.retryPct)),              a: prev.retryPct,           b: last.retryPct,           hib: true  },
    { label: 'Not connected',          vals: pglobals.map(g => fmtPct(g.missPct)),               a: prev.missPct,            b: last.missPct,            hib: false },
  ]

  return (
    <div className="card mb-7">
      <div className="card-header">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Period Comparison</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Key metrics across extraction windows · Δ shows latest vs previous period</p>
          </div>
          <button
            onClick={() => downloadPeriodComparison(periods, extractedDate)}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <Download size={12} />
            Export
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Metric</th>
              {periods.map((p, i) => (
                <th key={p.date_range} className={`px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wide ${PERIOD_COL_COLORS[i] ?? 'text-slate-400 dark:text-slate-500'}`}>
                  {formatDate(p.date_range)}
                </th>
              ))}
              <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Δ Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.label} className="border-b border-slate-100 dark:border-slate-700/50 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-400 font-medium">{row.label}</td>
                {row.vals.map((v, i) => (
                  <td key={i} className="px-5 py-3 text-xs font-semibold text-slate-800 dark:text-slate-200 text-right tabular-nums">{v}</td>
                ))}
                <td className="px-5 py-3 text-right">
                  {row.a != null
                    ? <DeltaBadge a={row.a} b={row.b} higherIsBetter={row.hib} />
                    : <span className="text-xs text-slate-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NoAdoptionRiskTable({ institutions, navigate, extractedDate }) {
  const [activeBucket, setActiveBucket] = useState('100k+')

  const bucketed = BUCKETS.map(b => ({
    ...b,
    rows: institutions
      .filter(i => !i.retry_enabled && i.dialed_raw > 0 && i.dialed_raw >= b.min && i.dialed_raw < b.max)
      .map(i => ({ ...i, name: institutionLabel(i.institution_id) })),
  }))

  const active = bucketed.find(b => b.key === activeBucket)

  return (
    <div className="card mb-7">
      <div className="card-header">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">No Adoption <span className="text-red-600 dark:text-red-400">(RISK)</span></h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Voice institutions dialing at scale but not using retry — bucketed by total dialed
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {bucketed.map(b => (
              <button
                key={b.key}
                onClick={() => setActiveBucket(b.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  activeBucket === b.key
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {b.label}
                <span className={`ml-1.5 text-[10px] font-normal ${activeBucket === b.key ? 'opacity-80' : 'text-slate-400 dark:text-slate-500'}`}>
                  {b.rows.length}
                </span>
              </button>
            ))}
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
            <button
              onClick={() => downloadNoAdoptionRisk(institutions, extractedDate)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <Download size={12} />
              Export
            </button>
          </div>
        </div>
      </div>
      <div className="p-4">
        <SortableTable
          key={activeBucket}
          data={active?.rows ?? []}
          columns={noRiskColumns}
          globalFilterPlaceholder="Search institution…"
          pageSize={25}
          onRowClick={row => navigate(`/institutions/${row.institution_id}`)}
        />
      </div>
    </div>
  )
}

function InstitutionRankTable({ title, subtitle, rows, navigate, headerRight }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
            {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {headerRight}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700">
              <th className="px-4 py-3 text-left font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide text-[10px]">#</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide text-[10px]">Institution</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide text-[10px]">Connect %</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide text-[10px]">Lift</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide text-[10px]">Dialed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const name = institutionLabel(row.institution_id)
              return (
                <tr
                  key={row.institution_id}
                  className="border-b border-slate-50 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/institutions/${row.institution_id}`)}
                >
                  <td className="px-4 py-2.5 text-slate-400 dark:text-slate-500 font-medium">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">{name}</p>
                    <p className="text-slate-400 dark:text-slate-500 text-[10px]">#{row.institution_id} · {row.server}</p>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-bold ${connectColor(row.connect_pct)}`}>
                    {fmtPct(row.connect_pct)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-violet-600 dark:text-violet-400">
                    +{row.connect_lift_pct?.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400">{fmtNum(row.dialed)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
