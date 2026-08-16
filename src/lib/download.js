import * as XLSX from 'xlsx'
import { institutionLabel } from './accounts'

const BUCKETS = [
  { label: '100k+',     min: 100_000, max: Infinity },
  { label: '25k–100k',  min: 25_000,  max: 100_000  },
  { label: 'Below 25k', min: 0,        max: 25_000   },
]

function exportedOn() {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function deltaStr(a, b) {
  if (a == null || b == null) return '—'
  const diff = b - a
  if (Math.abs(diff) < 0.005) return '0 pp'
  return `${diff > 0 ? '+' : ''}${diff.toFixed(2)} pp`
}

export function downloadPeriodComparison(periods, extractedDate) {
  const pglobals = periods.map(p => {
    const g = p.global
    const retry = g.r1 + g.r2 + g.r3 + g.r4 + g.r5
    return {
      ...g,
      retryPct:   g.dialed > 0 ? retry / g.dialed * 100 : 0,
      firstPct:   g.dialed > 0 ? g.first_attempt / g.dialed * 100 : 0,
      missPct:    g.dialed > 0 ? g.not_connected / g.dialed * 100 : 0,
    }
  })

  const prev = pglobals[pglobals.length - 2]
  const last = pglobals[pglobals.length - 1]

  const periodHeaders = periods.map((p, i) => `P${i + 1} (${p.date_range})`)
  const totalCols = 1 + periods.length + 1

  const dataRows = [
    ['Dialed',                   ...pglobals.map(g => g.dialed),                                       '—'],
    ['Connect Rate %',           ...pglobals.map(g => +(g.connect_pct.toFixed(2))),                    deltaStr(prev.connect_pct,      last.connect_pct)      ],
    ['Connect Lift (retries)',   ...pglobals.map(g => +(g.connect_lift_pct.toFixed(2))),               deltaStr(prev.connect_lift_pct, last.connect_lift_pct) ],
    ['Connected — 1st call %',   ...pglobals.map(g => +(g.firstPct.toFixed(2))),                       deltaStr(prev.firstPct,         last.firstPct)         ],
    ['Connected — via retry %',  ...pglobals.map(g => +(g.retryPct.toFixed(2))),                       deltaStr(prev.retryPct,         last.retryPct)         ],
    ['Not connected %',          ...pglobals.map(g => +(g.missPct.toFixed(2))),                        deltaStr(prev.missPct,          last.missPct)          ],
  ]

  const aoa = [
    ['Mio AI Voice Retry — Period Comparison', ...Array(totalCols - 1).fill(null)],
    [`Exported: ${exportedOn()}`],
    [],
    ['Metric', ...periodHeaders, 'Δ Change (prev → latest)'],
    ...dataRows,
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }]
  ws['!cols'] = [{ wch: 28 }, ...periods.map(() => ({ wch: 22 })), { wch: 24 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Period Comparison')
  XLSX.writeFile(wb, `mio-voice-retry-period-comparison-${extractedDate}.xlsx`)
}

export function downloadNoAdoptionRisk(institutions, extractedDate) {
  const dataRows = BUCKETS.flatMap(b =>
    institutions
      .filter(i => !i.retry_enabled && i.dialed_raw > 0 && i.dialed_raw >= b.min && i.dialed_raw < b.max)
      .sort((a, x) => x.dialed_raw - a.dialed_raw)
      .map(i => [b.label, institutionLabel(i.institution_id), i.institution_id, i.server, i.dialed_raw, i.first_attempt_raw, i.campaigns])
  )

  const aoa = [
    ['Mio AI Voice Retry — No Adoption Risk', null, null, null, null, null, null],
    [`Exported: ${exportedOn()}`],
    [],
    ['Bucket', 'Institution Name', 'Institution ID', 'Server', 'Dialed (all campaigns)', 'Connected — 1st call', 'Campaigns'],
    ...dataRows,
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }]
  ws['!cols'] = [{ wch: 12 }, { wch: 35 }, { wch: 16 }, { wch: 10 }, { wch: 22 }, { wch: 22 }, { wch: 12 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'No Adoption Risk')
  XLSX.writeFile(wb, `mio-voice-retry-no-adoption-risk-${extractedDate}.xlsx`)
}
