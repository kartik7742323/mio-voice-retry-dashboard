import summary from '../data/summary.json'
import facts from '../data/facts.json'

// ── Filter dimensions (dummy; swap facts.json for real data later) ───────────
export const AGENTS   = facts.agents
export const DATE_MIN = facts.date_min
export const DATE_MAX = facts.date_max
const ROWS = facts.rows

// Institutions sorted for the College dropdown come from the config snapshot.
const BASE_INST = summary.by_institution

const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
/** '2026-06-23' → '23jun26' (compact label the app's formatDate understands) */
export function compactDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${parseInt(d, 10)}${MONTHS[parseInt(m, 10) - 1]}${y.slice(2)}`
}

function emptyOutcome() {
  return { dialed: 0, first_attempt: 0, r1: 0, r2: 0, r3: 0, r4: 0, r5: 0, retry_exhausted: 0, next_retry_scheduled: 0, attempts: 0 }
}
function addRow(acc, r) {
  acc.dialed += r.dialed
  acc.first_attempt += r.first_attempt
  acc.r1 += r.r1; acc.r2 += r.r2; acc.r3 += r.r3; acc.r4 += r.r4; acc.r5 += r.r5
  acc.retry_exhausted += r.retry_exhausted
  acc.next_retry_scheduled += r.next_retry_scheduled
  acc.attempts += (r.attempts || 0)
}
/** finalise an accumulated outcome into the {…, connected, connect_pct, connect_lift_pct} shape */
function finalize(o) {
  const retry = o.r1 + o.r2 + o.r3 + o.r4 + o.r5
  const connected = o.first_attempt + retry
  return {
    ...o,
    connected,
    not_connected: Math.max(0, o.dialed - connected),
    connect_pct: o.dialed > 0 ? +(connected / o.dialed * 100).toFixed(2) : 0,
    connect_lift_pct: o.dialed > 0 ? +(retry / o.dialed * 100).toFixed(2) : 0,
  }
}

/**
 * Excel-style value matcher. A selection is { op: 'in' | 'nin', values: [] }.
 * Empty `values` (or a falsy selection) means "no constraint" → matches everything.
 *   op 'in'  → value must be one of values (Equals / is any of)
 *   op 'nin' → value must NOT be one of values (Not equals / is none of)
 */
export function matchVal(sel, val) {
  if (!sel || !sel.values || sel.values.length === 0) return true
  const has = sel.values.includes(val)
  return sel.op === 'nin' ? !has : has
}

/** Adoption is a configuration snapshot → scoped by College only (not agent/date). */
function buildAdoption(college) {
  // No college constraint → exact global snapshot.
  if (!college || !college.values || college.values.length === 0) return summary.adoption

  const matched = BASE_INST.filter(i => matchVal(college, i.institution_id))
  const acc = { voice_institutions: 0, retry_institutions: 0, voice_campaigns: 0, retry_campaigns: 0,
    mode_immediate: 0, mode_scheduled: 0, retry_count_dist: { 1:0,2:0,3:0,4:0,5:0 }, dialed_retry: 0, dialed_total: 0 }
  for (const i of matched) {
    acc.voice_institutions++
    if (i.retry_enabled) acc.retry_institutions++
    acc.voice_campaigns += i.campaigns || 0
    const rc = i.retry_enabled_campaigns || 0
    acc.retry_campaigns += rc
    acc.dialed_retry += i.dialed || 0
    acc.dialed_total += i.dialed_raw || 0
    if (rc > 0) {
      const bucket = Math.min(5, Math.max(1, Math.round(i.avg_configured_retries || 0))) || 1
      acc.retry_count_dist[bucket] += rc
    }
    if (i.dominant_mode === 'immediate') acc.mode_immediate += rc
    else if (i.dominant_mode === 'schedule') acc.mode_scheduled += rc
  }
  return acc
}

/** Split the selected range in half → two comparable periods for Period Comparison. */
function buildPeriods(matched, from, to) {
  const start = new Date(from + 'T00:00:00Z')
  const end   = new Date(to + 'T00:00:00Z')
  const days  = Math.round((end - start) / 86400000) + 1
  if (days < 2) return []
  const mid = new Date(start); mid.setUTCDate(mid.getUTCDate() + Math.floor(days / 2))
  const midIso = mid.toISOString().slice(0, 10)
  const prevIso = new Date(mid.getTime() - 86400000).toISOString().slice(0, 10)

  const a = emptyOutcome(), b = emptyOutcome()
  for (const r of matched) addRow(r.date < midIso ? a : b, r)
  if (a.dialed === 0 || b.dialed === 0) return []
  return [
    { date_range: `${compactDate(from)}-${compactDate(prevIso)}`, global: finalize(a) },
    { date_range: `${compactDate(midIso)}-${compactDate(to)}`,    global: finalize(b) },
  ]
}

/**
 * Roll the fact table up under the active filter and return a summary.json-shaped
 * view the existing pages already know how to render.
 */
export function computeView({ college, from = DATE_MIN, to = DATE_MAX } = {}) {
  const matched = ROWS.filter(r =>
    matchVal(college, r.iid) &&
    r.date >= from && r.date <= to
  )

  const g = emptyOutcome()
  const byIid = new Map()
  for (const r of matched) {
    addRow(g, r)
    let o = byIid.get(r.iid)
    if (!o) { o = emptyOutcome(); byIid.set(r.iid, o) }
    addRow(o, r)
  }

  const by_institution = BASE_INST
    .filter(i => matchVal(college, i.institution_id))
    .map(i => {
      const o = finalize(byIid.get(i.institution_id) || emptyOutcome())
      // keep config fields (campaigns, retry flags, *_raw) from the snapshot,
      // overlay filtered outcome metrics
      return { ...i, ...o }
    })

  return {
    ...summary,
    extracted_date: `${compactDate(from)}-${compactDate(to)}`,
    global: finalize(g),
    adoption: buildAdoption(college),
    by_institution,
    periods: buildPeriods(matched, from, to),
  }
}

/**
 * Single-institution view for the detail page. Ignores the College filter
 * (the URL already scopes to one institution) but honours Agent + Date, so the
 * detail cards move with those filters. Always resolves the institution config.
 */
export function computeInstitution(instId, { from = DATE_MIN, to = DATE_MAX } = {}) {
  const base = BASE_INST.find(i => i.institution_id === instId)
  if (!base) return null
  const o = emptyOutcome()
  for (const r of ROWS) {
    if (r.iid !== instId) continue
    if (r.date < from || r.date > to) continue
    addRow(o, r)
  }
  return { ...base, ...finalize(o) }
}

/** Options for the College dropdown, sorted by display name. */
export function collegeOptions(labelFn) {
  return BASE_INST
    .map(i => ({ id: i.institution_id, label: labelFn(i.institution_id) }))
    .sort((a, b) => a.label.localeCompare(b.label))
}
