import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import SortableTable from '../components/SortableTable'
import { fmtFull, fmtPct, connectColor } from '../lib/format'
import { institutionLabel } from '../lib/accounts'

const col = createColumnHelper()

function ModeBadge({ mode }) {
  if (!mode) return <span className="text-slate-300 dark:text-slate-600">—</span>
  const map = {
    immediate: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    schedule:  'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  }
  return <span className={`badge ${map[mode]}`}>{mode === 'immediate' ? 'Immediate' : 'Scheduled'}</span>
}

const NA = <span className="text-slate-300 dark:text-slate-600">—</span>

const columns = [
  col.accessor('name', {
    header: 'Client',
    cell: info => {
      const r = info.row.original
      return (
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[220px]">{info.getValue()}</p>
            {r.noRetry && (
              <span className="badge bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 shrink-0">Retry not used</span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">#{r.institution_id} · {r.server}</p>
        </div>
      )
    },
  }),
  col.accessor('retry_enabled_campaigns', {
    header: 'Retry Campaigns',
    cell: info => (
      <span className={info.row.original.noRetry ? 'text-red-500 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}>
        {fmtFull(info.getValue())}<span className="text-slate-300 dark:text-slate-600"> / {fmtFull(info.row.original.campaigns)}</span>
      </span>
    ),
  }),
  col.accessor('dominant_mode', {
    header: 'Mode',
    cell: info => <ModeBadge mode={info.getValue()} />,
  }),
  col.accessor('eff_dialed', {
    header: 'Dialed',
    cell: info => (
      <span className={`font-medium ${info.row.original.noRetry ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
        {fmtFull(info.getValue())}
      </span>
    ),
  }),
  col.accessor('eff_first', {
    header: 'Connected 1st',
    cell: info => (
      <span className={`font-medium ${info.row.original.noRetry ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
        {fmtFull(info.getValue())}
      </span>
    ),
  }),
  col.accessor('retry_connected', {
    header: 'Connected via Retry',
    cell: info => info.row.original.noRetry
      ? NA
      : <span className="font-medium text-indigo-700 dark:text-indigo-400">{fmtFull(info.getValue())}</span>,
  }),
  col.accessor('eff_connect_pct', {
    header: 'Connect %',
    cell: info => (
      <span className={`font-semibold ${info.row.original.noRetry ? 'text-red-600 dark:text-red-400' : connectColor(info.getValue())}`}>
        {fmtPct(info.getValue())}
      </span>
    ),
  }),
  col.accessor('connect_lift_pct', {
    header: 'Retry Lift',
    cell: info => info.row.original.noRetry
      ? NA
      : (
        <span className="font-semibold text-violet-600 dark:text-violet-400">
          {info.getValue() != null ? '+' + info.getValue().toFixed(1) + '%' : '—'}
        </span>
      ),
  }),
]

export default function Institutions({ data }) {
  const navigate = useNavigate()
  const [onlyAdopters, setOnlyAdopters] = useState(true)

  const rows = useMemo(() => {
    return data.by_institution
      .filter(i => (onlyAdopters ? i.retry_enabled : true))
      .map(i => ({
        ...i,
        name: institutionLabel(i.institution_id),
        retry_connected: (i.r1 ?? 0) + (i.r2 ?? 0) + (i.r3 ?? 0) + (i.r4 ?? 0) + (i.r5 ?? 0),
        noRetry: !i.retry_enabled,
        eff_dialed: i.dialed,
        eff_first: i.first_attempt,
        eff_connect_pct: i.connect_pct,
      }))
  }, [data, onlyAdopters])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Institutions</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            {rows.length.toLocaleString()} institutions &middot; click a row for campaign-level detail
            {!onlyAdopters && (
              <span className="text-red-500 dark:text-red-400"> &middot; <span className="font-medium">red</span> = dialed but retry not used</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setOnlyAdopters(true)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              onlyAdopters
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            Retry adopters
          </button>
          <button
            onClick={() => setOnlyAdopters(false)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              !onlyAdopters
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            All institutions
          </button>
        </div>
      </div>

      <SortableTable
        data={rows}
        columns={columns}
        globalFilterPlaceholder="Search by name or institution ID…"
        pageSize={50}
        onRowClick={row => navigate(`/institutions/${row.institution_id}`)}
      />
    </div>
  )
}
