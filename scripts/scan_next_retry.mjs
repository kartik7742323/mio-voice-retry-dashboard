/**
 * Find calls STILL in "next retry scheduled" with a dial date in [1 Aug, 5 Aug) 2026.
 *  scheduled (per DATA_SPEC) = NOT connected AND processed==0 AND retry_count != configured AND configured>0
 *  Output: college_name, college_id(tenant_id), communication_log_id, execution_id, agent_id
 */
import { createReadStream, writeFileSync, readFileSync } from 'node:fs'

const FILE = 'C:/Users/Kartik/Downloads/MIO_Voice.csv'
const OUT = 'C:/Users/Kartik/Downloads/next_retry_scheduled_1to5aug.csv'
const FROM = '2026-08-01', TO = '2026-08-05'   // added_on date >= FROM and < TO (1–4 Aug)
const NEED = ['added_on', 'created_on', 'tenant_id', 'communication_log_id', 'execution_id',
  'agent_id', 'answered', 'status', 'retry_count', 'configured_retry_count', 'processed']

// college id -> name (full Accounts.csv)
function splitCSV(line) { const o = []; let c = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"') { if (line[i + 1] === '"') { c += '"'; i++ } else q = false } else c += ch } else if (ch === '"') q = true; else if (ch === ',') { o.push(c); c = '' } else c += ch } o.push(c); return o }
const acc = {}
{
  const t = readFileSync('C:/Users/Kartik/Downloads/Accounts.csv', 'utf8').replace(/^\uFEFF/, '')
  const L = t.split(/\r?\n/).filter(Boolean); const H = splitCSV(L[0]).map(h => h.trim())
  const ii = H.indexOf('id'), ni = H.indexOf('name')
  for (let i = 1; i < L.length; i++) { const f = splitCSV(L[i]); if (f[ii]) acc[f[ii].trim()] = (f[ni] || '').trim() }
}
const isoOf = s => { const n = +s; if (!n) return null; const d = new Date(n * 1000); return isNaN(d) ? null : d.toISOString().slice(0, 10) }

let header = null, needIdx = null, fieldIdx = 0, cur = '', inQ = false, pending = false, rowVals = {}, hdr = []
let n = 0, matched = 0
const rows = []
const t0 = Date.now()

function onData(v) {
  const date = isoOf(v.added_on) || isoOf(v.created_on)
  if (!date || date < FROM || date >= TO) return
  const connected = v.answered === '1' || v.status === 'completed' || v.status === 'answered'
  if (connected) return
  const C = parseInt(v.configured_retry_count, 10) || 0
  if (C <= 0) return                              // retry must be enabled
  if (v.processed !== '0') return                 // still in-flight
  const rc = parseInt(v.retry_count, 10)
  if (Number.isFinite(rc) && rc === C) return     // reached configured count → not pending
  matched++
  rows.push([acc[String(parseInt(v.tenant_id, 10))] || '', parseInt(v.tenant_id, 10), v.communication_log_id, v.execution_id, v.agent_id, date, v.retry_count || '', C, v.status || ''])
}

const endField = () => { if (header) { const k = needIdx[fieldIdx]; if (k) rowVals[k] = cur } else hdr.push(cur); cur = ''; fieldIdx++ }
const endRow = () => {
  endField()
  if (!header) { header = hdr.map(h => h.replace(/^\uFEFF/, '').replace(/^"|"$/g, '')); needIdx = {}; header.forEach((h, i) => { if (NEED.includes(h)) needIdx[i] = h }) }
  else { n++; onData(rowVals); rowVals = {}; if (n % 1000000 === 0) console.log(`  ${(n / 1e6).toFixed(0)}M rows · ${((Date.now() - t0) / 1000).toFixed(0)}s · matched ${matched}`) }
  fieldIdx = 0
}
const need = () => !header || needIdx[fieldIdx]
function feed(chunk) {
  for (let k = 0; k < chunk.length; k++) {
    const ch = chunk[k]
    if (pending) { pending = false; if (ch === '"') { if (need()) cur += '"'; continue } inQ = false }
    if (inQ) { if (ch === '"') pending = true; else if (need()) cur += ch; continue }
    if (ch === '"') inQ = true
    else if (ch === ',') endField()
    else if (ch === '\n') endRow()
    else if (ch !== '\r') { if (need()) cur += ch }
  }
}
createReadStream(FILE, { encoding: 'utf8' }).on('data', feed).on('end', () => {
  if (cur !== '' || fieldIdx > 0) endRow()
  const headerRow = ['college_name', 'college_id', 'communication_log_id', 'execution_id', 'agent_id', 'dial_date', 'retry_count', 'configured_retries', 'status']
  const csv = [headerRow, ...rows].map(r => r.map(x => { const s = String(x ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }).join(',')).join('\r\n') + '\r\n'
  writeFileSync(OUT, csv)
  console.log(`\nTOTAL rows scanned: ${n.toLocaleString()}`)
  console.log(`MATCHED (next retry scheduled, 1–4 Aug): ${matched.toLocaleString()}`)
  const colleges = new Set(rows.map(r => r[1]))
  console.log(`distinct colleges: ${colleges.size}`)
  console.log(`\nwrote → ${OUT}`)
  console.log('\nfirst 20:')
  console.log(['college_name', 'college_id', 'comm_log_id', 'execution_id', 'agent_id'].join(' | '))
  for (const r of rows.slice(0, 20)) console.log([r[0], r[1], r[2], r[3], r[4]].join(' | '))
}).on('error', e => { console.error(e); process.exit(1) })
