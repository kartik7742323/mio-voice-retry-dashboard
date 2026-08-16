/** Format a large number with K/M suffix */
export function fmtNum(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

/** Format a percentage, 2 decimal places */
export function fmtPct(n) {
  if (n == null) return '—'
  return n.toFixed(2) + '%'
}

/** Full number with locale separators */
export function fmtFull(n) {
  if (n == null) return '—'
  return n.toLocaleString()
}

/** Colour class for connect rate */
export function connectColor(pct) {
  if (pct == null) return 'text-slate-400'
  if (pct >= 60) return 'text-emerald-600'
  if (pct >= 35) return 'text-amber-600'
  return 'text-red-600'
}

/** Colour class for connect lift from retries */
export function liftColor(pct) {
  if (pct == null) return 'text-slate-400'
  if (pct >= 15) return 'text-emerald-600'
  if (pct >= 5) return 'text-amber-600'
  return 'text-slate-500'
}

/** Convert "8jul26" → "8th Jul '26", or "23jun26-21jul26" → range */
export function formatDate(raw) {
  if (!raw) return raw
  const parseSingle = s => {
    const m = /^(\d+)([a-z]+)(\d+)$/i.exec(s.trim())
    if (!m) return s.trim()
    const day = parseInt(m[1])
    const monthMap = {
      jan:'Jan',feb:'Feb',mar:'Mar',apr:'Apr',may:'May',jun:'Jun',
      jul:'Jul',aug:'Aug',sep:'Sep',oct:'Oct',nov:'Nov',dec:'Dec',
    }
    const month = monthMap[m[2].toLowerCase()] || m[2]
    const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'
    return `${day}${suffix} ${month} '${m[3]}`
  }
  const parts = raw.split('-')
  if (parts.length === 2 && /^(\d+)([a-z]+)(\d+)$/i.test(parts[0].trim())) {
    return `${parseSingle(parts[0])} – ${parseSingle(parts[1])}`
  }
  return parseSingle(raw)
}

// Call-attempt distribution: connected on initial call, on each retry, or never.
export const ATTEMPT_COLORS = {
  first_attempt: '#22c55e',
  r1:            '#84cc16',
  r2:            '#eab308',
  r3:            '#f97316',
  r4:            '#ef4444',
  r5:            '#dc2626',
  not_connected: '#94a3b8',
}

export const ATTEMPT_LABELS = {
  first_attempt: 'Connected — 1st call',
  r1:            'Connected — Retry 1',
  r2:            'Connected — Retry 2',
  r3:            'Connected — Retry 3',
  r4:            'Connected — Retry 4',
  r5:            'Connected — Retry 5',
  not_connected: 'Not connected',
}

// Retry-mode palette (adoption)
export const MODE_COLORS = {
  immediate: '#6366f1',
  schedule:  '#0ea5e9',
}
