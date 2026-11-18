/**
 * Reference data for retry-OFF campaigns (campaigns-on-retry = 50.8%).
 * One row per communication_log_id with retry NOT enabled, showing its automation_list_id,
 * college, dials, connect, dates. Mirrors the dashboard's filters (live clients, 13 Jul→17 Nov).
 */
import { createReadStream, writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const SCRIPTS = dirname(fileURLToPath(import.meta.url))
const OUT = 'C:/Users/Kartik/Downloads/retry_off_campaigns.csv'
const MIN_DATE = '2026-07-13', SPLIT = '2026-10-26'
const SOURCES = [
  { file: 'C:/Users/Kartik/Downloads/retry_data_and_adoption.csv', from: MIN_DATE, to: SPLIT },
  { file: 'C:/Users/Kartik/Downloads/retry.csv', from: SPLIT, to: null },
]
const NEED = ['tenant_id', 'communication_log_id', 'automation_list_id', 'configured_retry_count', 'added_on', 'created_on', 'answered', 'status']
const ALLOW = (() => { try { return new Set(JSON.parse(readFileSync(join(SCRIPTS, '_live_ids.json'), 'utf8'))) } catch { return null } })()
const acc = JSON.parse(readFileSync(join(SCRIPTS, '../src/data/accounts.json'), 'utf8'))
const isoOf = s => { const n = +s; if (!n) return null; const d = new Date(n * 1000); return isNaN(d) ? null : d.toISOString().slice(0, 10) }

const camps = new Map()   // clog -> { iid, auto:Set, maxC, dialed, connected, dmin, dmax }
let curFrom, curTo
function onData(v) {
  const iid = parseInt(v.tenant_id, 10); if (!iid) return
  if (ALLOW && !ALLOW.has(iid)) return
  const clog = v.communication_log_id; if (!clog) return
  const date = isoOf(v.added_on) || isoOf(v.created_on)
  if (!date || date < curFrom || (curTo && date >= curTo)) return
  const C = parseInt(v.configured_retry_count, 10) || 0
  const connected = v.answered === '1' || v.status === 'completed' || v.status === 'answered'
  let cp = camps.get(clog)
  if (!cp) { cp = { iid, auto: new Set(), maxC: 0, dialed: 0, connected: 0, dmin: date, dmax: date }; camps.set(clog, cp) }
  if (C > cp.maxC) cp.maxC = C
  const al = (v.automation_list_id || '').trim(); if (al) cp.auto.add(al)
  cp.dialed++; if (connected) cp.connected++
  if (date < cp.dmin) cp.dmin = date; if (date > cp.dmax) cp.dmax = date
}

// streaming parser (needed cols only)
let header, needIdx, fieldIdx = 0, cur = '', inQ = false, pending = false, rowVals = {}, hdr = []
const need = () => !header || needIdx[fieldIdx]
function endField() { if (header) { const k = needIdx[fieldIdx]; if (k) rowVals[k] = cur } else hdr.push(cur); cur = ''; fieldIdx++ }
function endRow() { endField(); if (!header) { header = hdr.map(h => h.replace(/^\uFEFF/, '').replace(/^"|"$/g, '')); needIdx = {}; header.forEach((h, i) => { if (NEED.includes(h)) needIdx[i] = h }) } else { onData(rowVals); rowVals = {} } fieldIdx = 0 }
function feed(c) { for (let k = 0; k < c.length; k++) { const ch = c[k]; if (pending) { pending = false; if (ch === '"') { if (need()) cur += '"'; continue } inQ = false } if (inQ) { if (ch === '"') pending = true; else if (need()) cur += ch; continue } if (ch === '"') inQ = true; else if (ch === ',') endField(); else if (ch === '\n') endRow(); else if (ch !== '\r') { if (need()) cur += ch } } }
function reset() { header = null; needIdx = null; fieldIdx = 0; cur = ''; inQ = false; pending = false; rowVals = {}; hdr = [] }
function run(src) { return new Promise((res, rej) => { curFrom = src.from; curTo = src.to; reset(); const s = createReadStream(src.file, { encoding: 'utf8' }); s.on('data', feed); s.on('error', rej); s.on('end', () => { if (cur || fieldIdx) endRow(); res() }) }) }

for (const src of SOURCES) await run(src)

// retry-OFF campaigns
const off = [...camps.entries()].filter(([, c]) => c.maxC === 0)
let autoOff = 0, manualOff = 0
const rows = off.map(([clog, c]) => {
  const isAuto = c.auto.size > 0
  if (isAuto) autoOff++; else manualOff++
  return { name: acc[String(c.iid)] || '#' + c.iid, iid: c.iid, clog, auto: [...c.auto].join(';'),
    type: isAuto ? 'automation' : 'manual/LM', dialed: c.dialed, connected: c.connected,
    connect_pct: c.dialed ? +(c.connected / c.dialed * 100).toFixed(1) : 0, from: c.dmin, to: c.dmax }
}).sort((a, b) => b.dialed - a.dialed)

const H = ['college_name', 'college_id', 'communication_log_id', 'automation_list_id', 'campaign_type', 'dialed', 'connected', 'connect_pct', 'first_dial', 'last_dial']
const csv = [H, ...rows.map(r => [r.name, r.iid, r.clog, r.auto, r.type, r.dialed, r.connected, r.connect_pct, r.from, r.to])]
  .map(r => r.map(x => { const s = String(x ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }).join(',')).join('\r\n') + '\r\n'
writeFileSync(OUT, csv)

console.log('total campaigns:', camps.size, '| retry-OFF:', off.length, `(automation: ${autoOff}, manual/LM: ${manualOff})`)
console.log('wrote →', OUT)
console.log('\nTop 15 retry-OFF campaigns by dials:')
console.log('college | id | comm_log_id | automation_list_id | type | dialed | connect%')
for (const r of rows.slice(0, 15)) console.log([r.name.slice(0, 26), r.iid, r.clog, r.auto || '—', r.type, r.dialed, r.connect_pct + '%'].join(' | '))
