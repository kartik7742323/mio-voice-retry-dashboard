/**
 * Generates a DUMMY granular fact table for the global filters
 * (College × Agent × Date). Writes src/data/facts.json.
 *
 * Grain: one row per (institution, agent, day) with connect-outcome counts.
 * The client-side aggregator (src/lib/filterData.js) rolls these up under the
 * active College / Agent / Date-range filter to drive every KPI, chart & table.
 *
 * ⚠️ Synthetic. When real data lands, replace this generator (or hand the
 * pipeline the same {agents, date_min, date_max, rows[]} shape) — the app code
 * does not change.
 *
 *   node scripts/generate_dummy_facts.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const summary = JSON.parse(readFileSync(resolve(__dirname, '../src/data/summary.json'), 'utf8'))

// ── Dummy agents (replace with real caller/agent roster later) ───────────────
// skill  → multiplies base connect rate (so Agent filter changes rates)
// volume → relative share of dials handled
const AGENTS = [
  { name: 'Aarav Sharma',    skill: 1.12, volume: 1.3 },
  { name: 'Priya Nair',      skill: 1.06, volume: 1.1 },
  { name: 'Rahul Verma',     skill: 0.98, volume: 1.2 },
  { name: 'Sneha Iyer',      skill: 1.09, volume: 0.9 },
  { name: 'Vikram Singh',    skill: 0.91, volume: 1.0 },
  { name: 'Ananya Rao',      skill: 1.04, volume: 1.15 },
  { name: 'Karan Mehta',     skill: 0.87, volume: 0.85 },
  { name: 'Divya Menon',     skill: 1.15, volume: 0.95 },
  { name: 'Rohan Gupta',     skill: 0.95, volume: 1.05 },
  { name: 'Meera Krishnan',  skill: 1.01, volume: 1.0 },
]

const DATE_MIN = '2026-06-23'
const DATE_MAX = '2026-07-21'

// ── seeded RNG (deterministic build) ─────────────────────────────────────────
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260811)
const jitter = (lo, hi) => lo + (hi - lo) * rand()

// ── enumerate days in [DATE_MIN, DATE_MAX] ───────────────────────────────────
function eachDay(from, to) {
  const out = []
  const d = new Date(from + 'T00:00:00Z')
  const end = new Date(to + 'T00:00:00Z')
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}
const DAYS = eachDay(DATE_MIN, DATE_MAX)
const dayFactor = (iso) => {           // weekends dial less
  const wd = new Date(iso + 'T00:00:00Z').getUTCDay()
  return wd === 0 ? 0.28 : wd === 6 ? 0.4 : jitter(0.85, 1.15)
}

// ── build rows from each retry-enabled institution's base totals ─────────────
const GLOBAL = summary.global
const gConn = GLOBAL.first_attempt + GLOBAL.r1 + GLOBAL.r2 + GLOBAL.r3 + GLOBAL.r4 + GLOBAL.r5
const globalProps = {
  first_attempt: GLOBAL.first_attempt / gConn,
  r1: GLOBAL.r1 / gConn, r2: GLOBAL.r2 / gConn, r3: GLOBAL.r3 / gConn,
  r4: GLOBAL.r4 / gConn, r5: GLOBAL.r5 / gConn,
}

function instProps(i) {
  const c = i.first_attempt + i.r1 + i.r2 + i.r3 + i.r4 + i.r5
  if (!c) return globalProps
  return {
    first_attempt: i.first_attempt / c,
    r1: i.r1 / c, r2: i.r2 / c, r3: i.r3 / c, r4: i.r4 / c, r5: i.r5 / c,
  }
}

const rows = []
let seq = 0

for (const inst of summary.by_institution) {
  if (!inst.retry_enabled || inst.dialed <= 0) continue

  const iid = inst.institution_id
  const server = inst.server
  const baseRate = inst.connect_pct / 100 || (gConn / GLOBAL.dialed)
  const props = instProps(inst)

  // assign 2–4 agents deterministically
  const k = 2 + (iid % 3)
  const assigned = []
  for (let j = 0; j < k; j++) assigned.push(AGENTS[(iid + j) % AGENTS.length])

  // weight grid over (agent × day) → distribute this institution's dialed volume
  const cells = []
  let wSum = 0
  for (const ag of assigned) {
    for (const day of DAYS) {
      const w = ag.volume * dayFactor(day) * jitter(0.6, 1.4)
      cells.push({ ag, day, w })
      wSum += w
    }
  }

  for (const cell of cells) {
    const cellDialed = Math.round(inst.dialed * (cell.w / wSum))
    if (cellDialed <= 0) continue

    const rate = Math.min(0.95, Math.max(0.05, baseRate * cell.ag.skill * jitter(0.85, 1.15)))
    let connected = Math.round(cellDialed * rate)
    if (connected > cellDialed) connected = cellDialed

    // split connected across first_attempt + r1..r5
    const parts = ['r1', 'r2', 'r3', 'r4', 'r5'].map(key => Math.round(connected * props[key]))
    let used = parts.reduce((a, b) => a + b, 0)
    if (used > connected) { parts[0] = Math.max(0, parts[0] - (used - connected)); used = parts.reduce((a, b) => a + b, 0) }
    const first_attempt = Math.max(0, connected - used)

    const notConnected = cellDialed - connected
    const retry_exhausted = Math.round(notConnected * 0.97)
    const next_retry_scheduled = notConnected - retry_exhausted

    rows.push({
      id: seq++,
      iid,
      server,
      agent: cell.ag.name,
      date: cell.day,
      dialed: cellDialed,
      first_attempt,
      r1: parts[0], r2: parts[1], r3: parts[2], r4: parts[3], r5: parts[4],
      retry_exhausted,
      next_retry_scheduled,
    })
  }
}

const out = {
  synthetic: true,
  agents: AGENTS.map(a => a.name),
  date_min: DATE_MIN,
  date_max: DATE_MAX,
  rows,
}

writeFileSync(resolve(__dirname, '../src/data/facts.json'), JSON.stringify(out))
const dialed = rows.reduce((a, r) => a + r.dialed, 0)
const conn = rows.reduce((a, r) => a + r.first_attempt + r.r1 + r.r2 + r.r3 + r.r4 + r.r5, 0)
console.log(`facts.json written: ${rows.length} rows across ${AGENTS.length} agents × ${DAYS.length} days`)
console.log(`  total dialed ${dialed.toLocaleString()} · connect ${(conn / dialed * 100).toFixed(2)}%`)
