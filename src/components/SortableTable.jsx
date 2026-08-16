import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

function SortIcon({ sorted }) {
  if (sorted === 'asc')  return <ChevronUp size={14} className="text-blue-500" />
  if (sorted === 'desc') return <ChevronDown size={14} className="text-blue-500" />
  return <ChevronsUpDown size={14} className="text-slate-300 dark:text-slate-600" />
}

export default function SortableTable({
  data,
  columns,
  globalFilterPlaceholder = 'Search…',
  pageSize = 50,
  onRowClick,
}) {
  const [sorting, setSorting] = useState([])
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  })

  const pageCount = table.getPageCount()
  const pageIndex = table.getState().pagination.pageIndex

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="flex items-center gap-3">
        <input
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          placeholder={globalFilterPlaceholder}
          className="w-full sm:w-64 px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {table.getFilteredRowModel().rows.length.toLocaleString()} results
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <table className="min-w-full text-sm">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                {hg.headers.map(header => (
                  <th
                    key={header.id}
                    className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap select-none ${header.column.getCanSort() ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800' : ''}`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && <SortIcon sorted={header.column.getIsSorted()} />}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                className={`border-b border-slate-50 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                  No results found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Page {pageIndex + 1} of {pageCount}</span>
          <div className="flex items-center gap-1">
            {[
              { label: '«', fn: () => table.setPageIndex(0),      disabled: !table.getCanPreviousPage() },
              { label: '‹', fn: () => table.previousPage(),        disabled: !table.getCanPreviousPage() },
              { label: '›', fn: () => table.nextPage(),            disabled: !table.getCanNextPage() },
              { label: '»', fn: () => table.setPageIndex(pageCount - 1), disabled: !table.getCanNextPage() },
            ].map(({ label, fn, disabled }) => (
              <button
                key={label}
                onClick={fn}
                disabled={disabled}
                className="px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700"
              >{label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
