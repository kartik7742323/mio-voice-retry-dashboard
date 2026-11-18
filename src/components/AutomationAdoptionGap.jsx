import { useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { AlertCircle, ChevronDown, ChevronUp, Calendar } from 'lucide-react'
import SortableTable from './SortableTable'
import { fmtFull, fmtPct } from '../lib/format'
import { institutionLabel } from '../lib/accounts'

const col = createColumnHelper()

const gapColumns = [
  col.accessor('name', {
    header: 'College',
    cell: info => (
      <div>
        <p className="font-medium text-slate-800 dark:text-slate-200">{info.getValue()}</p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500">#{info.row.original.institution_id}</p>
      </div>
    ),
  }),
  col.accessor('automation_retry_enabled_date', {
    header: 'Enabled Date',
    cell: info => {
      const date = info.getValue()
      if (!date) return '—'
      const d = new Date(date)
      const now = new Date('2026-09-28')
      const days = Math.floor((now - d) / (1000 * 60 * 60 * 24))
      return (
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {d.toLocaleDateString()} <span className="text-slate-400">({days}d ago)</span>
        </span>
      )
    },
  }),
  col.accessor('campaigns', {
    header: 'Campaigns Run',
    cell: info => <span className="font-medium text-slate-700 dark:text-slate-300">{fmtFull(info.getValue())}</span>,
  }),
  col.accessor('retry_enabled_campaigns', {
    header: 'Retry Used',
    cell: info => <span className="text-red-500 dark:text-red-400 font-semibold">{info.getValue() || '0'}</span>,
  }),
  col.accessor('dialed_raw', {
    header: 'Leads Dialed',
    cell: info => <span className="text-slate-600 dark:text-slate-400">{fmtFull(info.getValue())}</span>,
  }),
]

export default function AutomationAdoptionGap({ data }) {
  const [expanded, setExpanded] = useState(false)

  const byInst = data.by_institution

  // Colleges with automation campaigns but retry enabled yet not used
  const gapColleges = byInst
    .filter(i => i.dialed_raw > 0 && i.automation_retry_enabled && i.retry_enabled_campaigns === 0)
    .map(i => ({ ...i, name: institutionLabel(i.institution_id) }))
    .sort((a, b) => {
      const dateA = new Date(a.automation_retry_enabled_date || '9999-99-99')
      const dateB = new Date(b.automation_retry_enabled_date || '9999-99-99')
      return dateA - dateB
    })

  if (gapColleges.length === 0) return null

  const totalAutoColleges = byInst.filter(i => i.dialed_raw > 0).length
  const adoptionRate = totalAutoColleges > 0
    ? ((totalAutoColleges - gapColleges.length) / totalAutoColleges * 100).toFixed(1)
    : 0

  return (
    <div className="card border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-start justify-between hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
      >
        <div className="flex items-start gap-3 flex-1 text-left">
          <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-amber-900 dark:text-amber-100">Adoption Gap — Retry Enabled But Not Used</h3>
            <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
              <span className="font-bold">{gapColleges.length} colleges</span> have automation retry enabled but haven't run retry campaigns yet
              <span className="text-amber-700 dark:text-amber-400 ml-2">({adoptionRate}% adoption rate)</span>
            </p>
          </div>
        </div>
        <div className="shrink-0 ml-2">
          {expanded ? (
            <ChevronUp size={16} className="text-amber-600 dark:text-amber-400" />
          ) : (
            <ChevronDown size={16} className="text-amber-600 dark:text-amber-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-amber-200 dark:border-amber-900/40">
          <SortableTable
            data={gapColleges}
            columns={gapColumns}
            globalFilterPlaceholder="Search college…"
            pageSize={15}
          />
        </div>
      )}
    </div>
  )
}
