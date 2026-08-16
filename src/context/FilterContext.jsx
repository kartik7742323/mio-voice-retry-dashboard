import { createContext, useContext, useMemo, useState, useCallback } from 'react'
import { computeView, DATE_MIN, DATE_MAX } from '../lib/filterData'

const EMPTY_SEL = { op: 'in', values: [] }
const DEFAULTS = {
  college: { ...EMPTY_SEL },
  from: DATE_MIN,
  to: DATE_MAX,
}

const FilterContext = createContext(null)

export function FilterProvider({ children }) {
  const [filters, setFilters] = useState(DEFAULTS)

  const update = useCallback((patch) => setFilters(f => ({ ...f, ...patch })), [])
  const reset  = useCallback(() => setFilters(DEFAULTS), [])

  const view = useMemo(() => computeView(filters), [filters])

  const activeCount =
    (filters.college?.values?.length ? 1 : 0) +
    (filters.from !== DATE_MIN || filters.to !== DATE_MAX ? 1 : 0)

  const value = useMemo(
    () => ({ filters, update, reset, view, activeCount }),
    [filters, update, reset, view, activeCount]
  )

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
}

export function useFilter() {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilter must be used within FilterProvider')
  return ctx
}
