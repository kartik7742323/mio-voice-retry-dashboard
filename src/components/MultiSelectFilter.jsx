import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Check, X, Search } from 'lucide-react'

/**
 * Excel-style multi-select filter with an Equals / Not-equals operator.
 *
 *   selection = { op: 'in' | 'nin', values: [] }   (empty values = no constraint)
 *
 * The dropdown is rendered in a portal with fixed positioning so it is never
 * clipped by an `overflow-hidden` ancestor (the filter bar / scroll container).
 */
export default function MultiSelectFilter({ icon: Icon, label, options, selection, onChange, searchable = true }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [pos, setPos] = useState(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  const op = selection?.op ?? 'in'
  const values = selection?.values ?? []

  const PANEL_W = 288

  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    let left = r.left
    if (left + PANEL_W > vw - 8) left = Math.max(8, vw - PANEL_W - 8)
    setPos({ top: r.bottom + 6, left })
  }, [])

  useEffect(() => {
    if (!open) return
    place()
    const onDoc = e => {
      if (triggerRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    const onMove = () => place()
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open, place])

  const filtered = useMemo(() => {
    if (!q.trim()) return options
    const t = q.trim().toLowerCase()
    return options.filter(o => String(o.label).toLowerCase().includes(t))
  }, [options, q])

  const labelFor = v => options.find(o => o.value === v)?.label ?? v
  const setOp = next => onChange({ op: next, values })
  const toggle = v => {
    const has = values.includes(v)
    onChange({ op, values: has ? values.filter(x => x !== v) : [...values, v] })
  }
  const clear = () => onChange({ op: 'in', values: [] })

  const summary = values.length === 0
    ? `All ${label}`
    : op === 'nin'
      ? (values.length === 1 ? `≠ ${labelFor(values[0])}` : `≠ ${values.length} ${label}`)
      : (values.length === 1 ? labelFor(values[0]) : `${values.length} ${label}`)

  const active = values.length > 0

  const panel = open && pos && createPortal(
    <div
      ref={panelRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: PANEL_W, maxWidth: 'calc(100vw - 16px)' }}
      className="z-[1000] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl overflow-hidden"
    >
      {/* operator */}
      <div className="flex items-center gap-1 p-2 border-b border-slate-100 dark:border-slate-700/60">
        {[['in', 'Equals'], ['nin', 'Not equals']].map(([val, txt]) => (
          <button
            key={val}
            type="button"
            onClick={() => setOp(val)}
            className={`flex-1 h-7 rounded-md text-[11px] font-semibold transition-colors ${
              op === val
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {txt}
          </button>
        ))}
      </div>

      {/* search */}
      {searchable && (
        <div className="relative p-2 border-b border-slate-100 dark:border-slate-700/60">
          <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            className="w-full h-8 pl-8 pr-2 rounded-md text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
      )}

      {/* options */}
      <div className="max-h-60 overflow-y-auto py-1">
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-slate-400">No matches</p>
        )}
        {filtered.map(o => {
          const checked = values.includes(o.value)
          return (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => toggle(o.value)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                checked
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'border-slate-300 dark:border-slate-600'
              }`}>
                {checked && <Check size={11} strokeWidth={3} />}
              </span>
              <span className="truncate text-slate-700 dark:text-slate-200">{o.label}</span>
            </button>
          )
        })}
      </div>

      {/* footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-900/30">
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          {values.length ? `${values.length} selected` : 'None selected'}
        </span>
        <button
          type="button"
          onClick={clear}
          disabled={!active}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-40 disabled:hover:text-slate-500"
        >
          <X size={12} /> Clear
        </button>
      </div>
    </div>,
    document.body,
  )

  return (
    <div className="relative" ref={triggerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full h-9 pl-9 pr-7 rounded-lg text-xs font-medium text-left flex items-center transition-colors
          bg-white dark:bg-slate-800 border
          ${active
            ? 'border-indigo-400 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/20'
            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'}`}
      >
        <Icon size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${active ? 'text-indigo-500' : 'text-slate-400 dark:text-slate-500'}`} />
        <span className="truncate">{summary}</span>
        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {panel}
    </div>
  )
}
