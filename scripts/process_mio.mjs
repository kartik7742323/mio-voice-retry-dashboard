/**
 * process_mio.mjs — roll the raw MIO_Voice.csv call log into the dashboard data
 * files, on a UNIQUE-LEAD basis (Mio AI Insights model).
 *
 *   • Lead key      = tenant_id + user_id   (user_id is 100% populated; lead_id is empty)
 *   • Leads Dialed  = distinct leads (each lead counts once, no matter how many attempts)
 *   • Connected     = a lead that answered on ANY attempt (1st call or any retry) → counts once
 *   • Connect rate  = unique connected leads ÷ unique leads dialed   (lead-wise, ~50%)
 *   • 1st-call vs retry = the attempt (within its earliest connecting campaign) on which the
 *                         lead first connected. connected on attempt 1 → 1st call; 2..6 → R1..R5.
 *   • college = tenant_id · instance = source_db (communication_inN→inN) · campaign = communication_log_id
 *   • retry_mode OFF (not in data) · configured_retries from configured_retry_count
 *   • Restricted to live-client colleges via scripts/_live_ids.json (delete to process all).
 *
 * Run:  node --max-old-space-size=6144 scripts/process_mio.mjs
 */
import { createReadStream, writeFileSync, mkdirSync, readdirSync, rmSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SCRIPTS = dirname(fileURLToPath(import.meta.url))
const ROOT = join(SCRIPTS, '..')
const FILE = 'C:/Users/Kartik/Downloads/MIO_Voice.csv'
const NEED = ['tenant_id', 'source_db', 'communication_log_id', 'added_on', 'created_on',
  'answered', 'status', 'retry_count', 'configured_retry_count', 'user_id']

const ALLOW = (() => {
  try { return new Set(JSON.parse(readFileSync(join(SCRIPTS, '_live_ids.json'), 'utf8'))) }
  catch { return null }
})()

// Strictly report from this date onward (call attempts before it are excluded).
const MIN_DATE = '2026-07-13'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const compactDate = iso => { const [y, m, d] = iso.split('-'); return `${+d}${MONTHS[+m - 1]}${y.slice(2)}` }
const isoOf = sec => { const n = +sec; if (!n) return null; const d = new Date(n * 1000); return isNaN(d) ? null : d.toISOString().slice(0, 10) }

const RKEYS = ['first_attempt', 'r1', 'r2', 'r3', 'r4', 'r5', 'retry_exhausted', 'next_retry_scheduled', 'attempts']
const zero = () => ({ dialed: 0, first_attempt: 0, r1: 0, r2: 0, r3: 0, r4: 0, r5: 0, retry_exhausted: 0, next_retry_scheduled: 0, attempts: 0 })
const addOut = (a, b) => { a.dialed += b.dialed; for (const k of RKEYS) a[k] += b[k] }
function finalize(o) {
  const retry = o.r1 + o.r2 + o.r3 + o.r4 + o.r5
  const connected = o.first_attempt + retry
  return { ...o, connected, not_connected: Math.max(0, o.dialed - connected),
    connect_pct: o.dialed > 0 ? +(connected / o.dialed * 100).toFixed(2) : 0,
    connect_lift_pct: o.dialed > 0 ? +(retry / o.dialed * 100).toFixed(2) : 0 }
}

// ── accumulators ─────────────────────────────────────────────────────────────
const leads = new Map()   // iid|user -> lead record (unique lead)
const camps = new Map()   // clog -> { iid, server, maxC, out } (row-based, for drill-down + adoption)
let scanned = 0
const t0 = Date.now()

function onData(v) {
  const iid = parseInt(v.tenant_id, 10)
  if (!iid) return
  if (ALLOW && !ALLOW.has(iid)) return
  const clog = v.communication_log_id
  const user = v.user_id
  if (!clog || !user) return
  const server = (v.source_db || '').replace(/^communication_/, '') || 'unknown'
  const aon = (+v.added_on) || (+v.created_on) || 0
  const date = isoOf(v.added_on) || isoOf(v.created_on)
  if (!date || date < MIN_DATE) return   // strictly 13 Jul onward
  const connected = v.answered === '1' || v.status === 'completed' || v.status === 'answered'
  let attempts = parseInt(v.retry_count, 10); if (!attempts || attempts < 1) attempts = 1
  const C = parseInt(v.configured_retry_count, 10) || 0

  // ── campaign (row grain) — drill-down + adoption/config ──
  let cp = camps.get(clog)
  if (!cp) { cp = { iid, server, maxC: 0, out: zero() }; camps.set(clog, cp) }
  if (C > cp.maxC) cp.maxC = C
  cp.out.dialed++; cp.out.attempts += attempts
  let cb = null
  if (connected) cb = attempts <= 1 ? 'first_attempt' : 'r' + Math.min(attempts - 1, 5)
  else if (C > 0 && attempts >= C + 1) cb = 'retry_exhausted'
  else if (C > 0) cb = 'next_retry_scheduled'
  if (cb) cp.out[cb]++

  // ── lead (unique) grain ──
  const lk = iid + '\u0001' + user
  let L = leads.get(lk)
  if (!L) { L = { iid, server, dateMin: date || '9999-99-99', attempts: 0, connected: false, connTime: Infinity, connIdx: 0, retryEligible: false, exhausted: false, scheduled: false }; leads.set(lk, L) }
  L.attempts += attempts
  if (C > 0) L.retryEligible = true
  if (date && date < L.dateMin) L.dateMin = date
  if (connected) {
    if (aon < L.connTime) { L.connTime = aon; L.connIdx = Math.min(attempts, 6) }  // attempt within earliest connecting campaign
    L.connected = true
  } else {
    if (C > 0 && attempts >= C + 1) L.exhausted = true
    else if (C > 0) L.scheduled = true
  }
}

// per-lead → outcome bucket (exactly one of: first_attempt / rN / retry_exhausted / next_retry_scheduled / none)
function leadOutcome(L) {
  const o = { first_attempt: 0, r1: 0, r2: 0, r3: 0, r4: 0, r5: 0, retry_exhausted: 0, next_retry_scheduled: 0 }
  if (L.connected) {
    const idx = L.connIdx
    if (idx <= 1) o.first_attempt = 1
    else o['r' + Math.min(idx - 1, 5)] = 1
  } else if (L.exhausted) o.retry_exhausted = 1
  else if (L.scheduled) o.next_retry_scheduled = 1
  return o
}
const addBucket = (acc, o) => { for (const k of ['first_attempt', 'r1', 'r2', 'r3', 'r4', 'r5', 'retry_exhausted', 'next_retry_scheduled']) acc[k] += o[k] }

// ── streaming CSV parser (materialises only NEEDED columns) ───────────────────
let header = null, needIdx = null, fieldIdx = 0, cur = '', inQ = false, pending = false, rowVals = {}, hdr = []
const NEED_HEADER = () => !header
function endField() { if (header) { const name = needIdx[fieldIdx]; if (name) rowVals[name] = cur } else hdr.push(cur); cur = ''; fieldIdx++ }
function endRow() {
  endField()
  if (!header) { header = hdr.map(h => h.replace(/^\uFEFF/, '').replace(/^"|"$/g, '')); needIdx = {}; header.forEach((h, i) => { if (NEED.includes(h)) needIdx[i] = h }) }
  else { scanned++; onData(rowVals); rowVals = {}; if (scanned % 1000000 === 0) console.log(`  ${(scanned/1e6).toFixed(0)}M rows · ${((Date.now()-t0)/1000).toFixed(0)}s · ${leads.size} leads · ${camps.size} campaigns`) }
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

console.log('Reading', FILE, ALLOW ? `(live-clients only: ${ALLOW.size})` : '(all colleges)', '…')
const stream = createReadStream(FILE, { encoding: 'utf8' })
stream.on('data', feed)
stream.on('error', e => { console.error('READ ERROR', e); process.exit(1) })
stream.on('end', () => { if (cur !== '' || fieldIdx > 0) endRow(); build() })

// ── post-processing → dashboard data files ───────────────────────────────────
function build() {
  console.log(`\nStream done: ${scanned.toLocaleString()} rows · ${leads.size.toLocaleString()} unique leads · ${((Date.now()-t0)/1000).toFixed(0)}s`)

  // lead-level rollup → facts (iid × first-dial date), per-college totals, global
  const factMap = new Map(), collegeLead = new Map()
  let leadsTotal = 0, leadsRetry = 0
  for (const [, L] of leads) {
    leadsTotal++; if (L.retryEligible) leadsRetry++
    const o = leadOutcome(L)
    let c = collegeLead.get(L.iid)
    if (!c) { c = { server: L.server, ...zero() }; collegeLead.set(L.iid, c) }
    c.dialed++; c.attempts += L.attempts; addBucket(c, o)
    const date = (L.dateMin && L.dateMin !== '9999-99-99') ? L.dateMin : null
    if (date) {
      const key = L.iid + '\u0001' + date
      let f = factMap.get(key)
      if (!f) { f = { iid: L.iid, server: L.server, date, ...zero() }; factMap.set(key, f) }
      f.dialed++; f.attempts += L.attempts; addBucket(f, o)
    }
  }

  const rows = [...factMap.values()].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.iid - b.iid)
  rows.forEach((r, i) => { r.id = i })
  const dates = rows.map(r => r.date)
  const date_min = dates.reduce((m, d) => d < m ? d : m, dates[0])
  const date_max = dates.reduce((m, d) => d > m ? d : m, dates[0])

  // campaigns grouped by college (counts + config)
  const campsByCollege = new Map()
  for (const [, cp] of camps) {
    let e = campsByCollege.get(cp.iid)
    if (!e) { e = { n: 0, retryN: 0, confSum: 0 }; campsByCollege.set(cp.iid, e) }
    e.n++; if (cp.maxC > 0) { e.retryN++; e.confSum += cp.maxC }
  }

  const by_institution = [...collegeLead.entries()].map(([iid, c]) => {
    const cc = campsByCollege.get(iid) || { n: 0, retryN: 0, confSum: 0 }
    const fin = finalize(c)
    return { institution_id: iid, server: c.server, campaigns: cc.n,
      retry_enabled_campaigns: cc.retryN, retry_enabled: cc.retryN > 0, dominant_mode: null,
      avg_configured_retries: cc.retryN ? +(cc.confSum / cc.retryN).toFixed(1) : 0,
      dialed_raw: c.dialed, first_attempt_raw: c.first_attempt, ...fin }
  }).sort((a, b) => b.dialed_raw - a.dialed_raw)

  const gOut = zero(); for (const [, c] of collegeLead) addOut(gOut, c)
  const retryCountDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let retryInstitutions = 0
  for (const [, cc] of campsByCollege) if (cc.retryN > 0) retryInstitutions++
  for (const [, cp] of camps) if (cp.maxC > 0) retryCountDist[Math.min(5, Math.max(1, cp.maxC))]++
  const retryCamps = [...camps.values()].filter(c => c.maxC > 0).length

  const adoption = {
    voice_institutions: collegeLead.size,
    retry_institutions: retryInstitutions,
    voice_campaigns: camps.size,
    retry_campaigns: retryCamps,
    mode_immediate: 0, mode_scheduled: 0,
    retry_count_dist: retryCountDist,
    dialed_retry: leadsRetry, dialed_total: leadsTotal,
  }

  const summary = {
    extracted_date: `${compactDate(date_min)}-${compactDate(date_max)}`,
    synthetic: false, adoption, global: finalize(gOut), periods: [], by_server: [], by_institution,
  }
  const facts = { synthetic: false, agents: [], date_min, date_max, rows }

  // per-campaign files (row grain) for drill-down
  const campaignsByInst = new Map()
  for (const [clog, cp] of camps) {
    const o = finalize(cp.out)
    const row = { campaign_id: clog, retry_enabled: cp.maxC > 0 ? 1 : 0, mode: null, configured_retries: cp.maxC,
      dialed: o.dialed, connected: o.connected, not_connected: o.not_connected,
      first_attempt: o.first_attempt, r1: o.r1, r2: o.r2, r3: o.r3, r4: o.r4, r5: o.r5,
      retry_exhausted: o.retry_exhausted, next_retry_scheduled: o.next_retry_scheduled,
      connect_pct: o.connect_pct, connect_lift_pct: o.connect_lift_pct }
    let arr = campaignsByInst.get(cp.iid); if (!arr) { arr = []; campaignsByInst.set(cp.iid, arr) }
    arr.push(row)
  }
  for (const arr of campaignsByInst.values()) arr.sort((a, b) => b.dialed - a.dialed)

  const DATA = join(ROOT, 'src', 'data'), CAMP = join(ROOT, 'public', 'data', 'campaigns')
  mkdirSync(DATA, { recursive: true }); mkdirSync(CAMP, { recursive: true })
  writeFileSync(join(DATA, 'summary.json'), JSON.stringify(summary))
  writeFileSync(join(DATA, 'facts.json'), JSON.stringify(facts))
  for (const f of readdirSync(CAMP)) if (f.endsWith('.json')) rmSync(join(CAMP, f))
  for (const [iid, arr] of campaignsByInst) writeFileSync(join(CAMP, `${iid}.json`), JSON.stringify(arr))

  const g = summary.global
  console.log('\n── WROTE (unique-lead model) ──────────')
  console.log(`colleges:            ${collegeLead.size}  (retry adopters: ${retryInstitutions})`)
  console.log(`campaigns:           ${camps.size}  (retry-enabled: ${retryCamps})`)
  console.log(`UNIQUE LEADS dialed: ${g.dialed.toLocaleString()}   (retry-eligible: ${leadsRetry.toLocaleString()})`)
  console.log(`total dials/attempts:${g.attempts.toLocaleString()}   avg attempts/lead: ${(g.attempts / g.dialed).toFixed(2)}`)
  console.log(`connected leads:     ${g.connected.toLocaleString()}   LEAD-WISE connect rate: ${g.connect_pct}%`)
  console.log(`connected 1st call:  ${g.first_attempt.toLocaleString()}   via retry: ${(g.connected - g.first_attempt).toLocaleString()}  (lift +${g.connect_lift_pct}%)`)
  console.log(`fact rows:           ${rows.length}   date ${date_min} → ${date_max}`)
}
