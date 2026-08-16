import { useMemo } from 'react'
import { Building2, Calendar, X, SlidersHorizontal } from 'lucide-react'
import { useFilter } from '../context/FilterContext'
import { DATE_MIN, DATE_MAX, collegeOptions } from '../lib/filterData'
import { institutionLabel } from '../lib/accounts'
import MultiSelectFilter from './MultiSelectFilter'

const selectClass =
  'w-full h-9 pl-9 pr-7 rounded-lg text-xs font-medium appearance-none cursor-pointer ' +
  'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 ' +
  'border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors'

const dateClass =
  'h-9 px-2 rounded-lg text-xs font-medium ' +
  'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 ' +
  'border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors ' +
  '[color-scheme:light] dark:[color-scheme:dark]'

function Field({ icon: Icon, children }) {
  return (
    <div className="relative">
      <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none z-10" />
      {children}
      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" viewBox="0 0 12 12" fill="none">
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export default function FilterBar() {
  const { filters, update, reset, activeCount } = useFilter()
  const collegeOpts = useMemo(
    () => collegeOptions(institutionLabel).map(c => ({ value: c.id, label: c.label })),
    [],
  )

  return (
    <div className="shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200/80 dark:border-slate-700/60 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 shrink-0 mr-1">
          <SlidersHorizontal size={14} />
          <span className="text-[11px] font-semibold uppercase tracking-wider hidden sm:inline">Filters</span>
        </div>

        {/* College */}
        <div className="w-full sm:w-56">
          <MultiSelectFilter
            icon={Building2}
            label="Colleges"
            options={collegeOpts}
            selection={filters.college}
            onChange={sel => update({ college: sel })}
          />
        </div>

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <Calendar size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
          <input
            type="date"
            className={dateClass}
            min={DATE_MIN}
            max={filters.to}
            value={filters.from}
            onChange={e => update({ from: e.target.value || DATE_MIN })}
          />
          <span className="text-slate-300 dark:text-slate-600 text-xs">→</span>
          <input
            type="date"
            className={dateClass}
            min={filters.from}
            max={DATE_MAX}
            value={filters.to}
            onChange={e => update({ to: e.target.value || DATE_MAX })}
          />
        </div>

        {activeCount > 0 && (
          <button
            onClick={reset}
            className="ml-auto inline-flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-red-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <X size={13} />
            Clear{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
        )}
      </div>
    </div>
  )
}
