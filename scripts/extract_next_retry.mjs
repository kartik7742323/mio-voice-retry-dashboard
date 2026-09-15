/**
 * extract_next_retry.mjs — per-CALL drill-down of the dashboard's NEXT SCHED column.
 * Replicates process_mio.mjs's row-grain next_retry_scheduled definition EXACTLY,
 * but emits the individual calls (execution_id + agent_id) instead of just the count.
 *
 * Scope: campaigns whose start date (dmin) is in [LO..HI] with next_retry_scheduled > 0,
 * read from the dashboard's own filtered files (public/data/campaigns/*.json).
 */
import { createReadStream, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as XLSX from 'xlsx'

const SCRIPTS = dirname(fileURLToPath(import.meta.url))
const ROOT = join(SCRIPTS, '..')
const FILE = 'C:/Users/Kartik/Downloads/MIO_Voice.csv'
const OUT_CSV = 'C:/Users/Kartik/Downloads/NextRetryScheduled_Aug1-5.csv'
const OUT_XLSX = 'C:/Users/Kartik/Downloads/NextRetryScheduled_Aug1-5.xlsx'
const MIN_DATE = '2026-07-13'
const LO = '2026-08-01', HI = '2026-08-05'

// column mapping (same semantics as process_mio.mjs) + the two drill-down fields
const NEED = ['tenant_id', 'communication_log_id', 'execution_id', 'agent_id', 'added_on',
  'created_on', 'answered', 'status', 'retry_count', 'configured_retry_count', 'user_id']

const isoOf = sec => { const n = +sec; if (!n) return null; const d = new Date(n * 1000); return isNaN(d) ? null : d.toISOString().slice(0, 10) }

// ── build target campaign set from the dashboard's filtered data ───────────────
const names = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'accounts.json'), 'utf8'))
const CAMP = join(ROOT, 'public', 'data', 'campaigns')
const target = new Map()   // clog -> { iid, name, expected }
for (const f of readdirSync(CAMP)) {
  if (!f.endsWith('.json')) continue
  const iid = f.replace('.json', '')
  for (const c of JSON.parse(readFileSync(join(CAMP, f), 'utf8'))) {
    if (c.next_retry_scheduled > 0 && c.date >= LO && c.date <= HI) {
      target.set(String(c.campaign_id), { iid, name: names[iid] || '(no name)', expected: c.next_retry_scheduled })
    }
  }
}
console.log(`Target campaigns (dashboard, ${LO}..${HI}, NEXT SCHED>0): ${target.size}`)

// ── scan raw log, emit matching per-call rows ─────────────────────────────────
const out = []          // detail rows
const got = new Map()   // clog -> count found (to verify against dashboard)
let scanned = 0
const t0 = Date.now()

function onData(v) {
  const clog = v.communication_log_id
  const t = target.get(clog)
  if (!t) return
  const user = v.user_id
  if (!user) return                         // process_mio drops rows without user_id
  const date = isoOf(v.added_on) || isoOf(v.created_on)
  if (!date || date < MIN_DATE) return
  const connected = v.answered === '1' || v.status === 'completed' || v.status === 'answered'
  let attempts = parseInt(v.retry_count, 10); if (!attempts || attempts < 1) attempts = 1
  const C = parseInt(v.configured_retry_count, 10) || 0
  // next_retry_scheduled bucket: not connected, retry enabled, not yet exhausted
  const isNRS = !connected && C > 0 && attempts < C + 1
  if (!isNRS) return
  got.set(clog, (got.get(clog) || 0) + 1)
  out.push({
    college_name: t.name,
    college_id: +t.iid,
    communication_log_id: clog,
    execution_id: v.execution_id || '',
    agent_id: v.agent_id || '',
    call_date: date,
    retry_count: attempts,
    configured_retry_count: C,
    status: v.status || '',
    answered: v.answered || '',
  })
}

// streaming CSV parser (materialises only NEEDED columns)
let header = null, needIdx = null, fieldIdx = 0, cur = '', inQ = false, pending = false, rowVals = {}, hdr = []
const NEED_HEADER = () => !header
function endField() { if (header) { const name = needIdx[fieldIdx]; if (name) rowVals[name] = cur } else hdr.push(cur); cur = ''; fieldIdx++ }
function endRow() {
  endField()
  if (!header) { header = hdr.map(h => h.replace(/^\uFEFF/, '').replace(/^"|"$/g, '')); needIdx = {}; header.forEach((h, i) => { if (NEED.includes(h)) needIdx[i] = h }) }
  else { scanned++; onData(rowVals); rowVals = {}; if (scanned % 1000000 === 0) console.log(`  ${(scanned / 1e6).toFixed(0)}M rows · ${((Date.now() - t0) / 1000).toFixed(0)}s · found ${out.length}`) }
  fieldIdx = 0
}
function feed(chunk) {
  for (let k = 0; k < chunk.length; k++) {
    const ch = chunk[k]
    if (pending) { pending = false; if (ch === '"') { if (NEED_HEADER() || needIdx[fieldIdx]) cur += '"'; continue } inQ = false }
    if (inQ) { if (ch === '"') pending = true; else if (NEED_HEADER() || needIdx[fieldIdx]) cur += ch; continue }
    if (ch === '"') inQ = true
    else if (ch === ',') endField()
    else if (ch === '\n') endRow()
    else if (ch !== '\r') { if (NEED_HEADER() || needIdx[fieldIdx]) cur += ch }
  }
}

console.log('Reading', FILE, '…')
const stream = createReadStream(FILE, { encoding: 'utf8' })
stream.on('data', feed)
stream.on('error', e => { console.error('READ ERROR', e); process.exit(1) })
stream.on('end', () => {
  if (cur !== '' || fieldIdx > 0) endRow()
  finish()
})

function finish() {
  console.log(`\nScan done: ${scanned.toLocaleString()} rows · ${((Date.now() - t0) / 1000).toFixed(0)}s · ${out.length.toLocaleString()} calls extracted\n`)
  // verify per-campaign counts vs dashboard
  let ok = 0, bad = 0, tExp = 0, tGot = 0
  const summaryRows = []
  for (const [clog, t] of [...target.entries()].sort((a, b) => b[1].expected - a[1].expected)) {
    const g = got.get(clog) || 0
    tExp += t.expected; tGot += g
    const match = g === t.expected
    if (match) ok++; else bad++
    summaryRows.push({ college_name: t.name, college_id: +t.iid, communication_log_id: clog, dashboard_next_sched: t.expected, extracted_calls: g, match: match ? 'YES' : 'MISMATCH' })
    console.log(`${match ? 'OK ' : 'XX '} clog=${clog} ${t.name}  dashboard=${t.expected}  extracted=${g}`)
  }
  console.log(`\nCampaigns matched: ${ok}/${target.size}  (mismatch: ${bad})`)
  console.log(`TOTAL  dashboard NEXT SCHED=${tExp.toLocaleString()}  extracted calls=${tGot.toLocaleString()}`)

  // sort detail by college then campaign
  out.sort((a, b) => a.college_id - b.college_id || (a.communication_log_id < b.communication_log_id ? -1 : 1))

  // CSV
  const cols = ['college_name', 'college_id', 'communication_log_id', 'execution_id', 'agent_id', 'call_date', 'retry_count', 'configured_retry_count', 'status', 'answered']
  const esc = s => { s = String(s ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  const csv = [cols.join(',')].concat(out.map(r => cols.map(c => esc(r[c])).join(','))).join('\n')
  writeFileSync(OUT_CSV, csv)
  console.log(`\nWrote CSV  : ${OUT_CSV}  (${out.length} rows)`)

  // XLSX (summary + detail)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary_by_campaign')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(out), 'Calls_next_retry_scheduled')
  XLSX.writeFile(wb, OUT_XLSX)
  console.log(`Wrote XLSX : ${OUT_XLSX}`)
}
