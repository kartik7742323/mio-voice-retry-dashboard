/**
 * generate_sample_data.mjs — Node port of generate_sample_data.py.
 *
 * ⚠️  Produces SYNTHETIC demo data so the dashboard renders before real data
 * exists. Replace with real process.py output (see DATA_SPEC.md) when ready.
 *
 * Run:  node scripts/generate_sample_data.mjs
 */
import { writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_SUMMARY = join(ROOT, 'src', 'data', 'summary.json')
const OUT_ACCOUNTS = join(ROOT, 'src', 'data', 'accounts.json')
const OUT_CAMPAIGNS = join(ROOT, 'public', 'data', 'campaigns')

// ── deterministic RNG (mulberry32) ────────────────────────────────────────────
let _s = 20260721 >>> 0
function rnd() {
  _s |= 0; _s = (_s + 0x6D2B79F5) | 0
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const randint = (a, b) => a + Math.floor(rnd() * (b - a + 1))
const uniform = (a, b) => a + rnd() * (b - a)
const choice = arr => arr[Math.floor(rnd() * arr.length)]
function weighted(items, weights) {
  const total = weights.reduce((s, w) => s + w, 0)
  let x = rnd() * total
  for (let i = 0; i < items.length; i++) { x -= weights[i]; if (x <= 0) return items[i] }
  return items[items.length - 1]
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

const SERVERS = ['in11', 'in12', 'in14', 'asia1', 'us1', 'eu1']
const N_INSTITUTIONS = 128
const EXTRACTED_DATE = '23jun26-21jul26'
const RETRY_WAVE_RATES = [0.17, 0.12, 0.085, 0.06, 0.04]

const PREFIX = ['Global', 'National', 'Sunrise', 'Heritage', 'Crescent', 'Summit',
  'Riverside', 'Metro', 'Pioneer', 'Everest', 'Lotus', 'Nova', 'Bluebell',
  'Greenfield', 'Ashford', 'Kingsley', 'Westwood', 'Trinity', 'Vidya', 'Amrita',
  'Sringeri', 'Deccan', 'Coastal', 'Highland']
const CORE = ['Institute of Technology', 'College of Management', 'University',
  'School of Business', 'Academy', 'Institute of Design', 'College of Engineering',
  'International School', 'Polytechnic', 'College of Arts & Science', 'School of Law',
  'Business School', 'Institute of Media', 'College of Nursing', 'School of Architecture']
const makeName = () => `${choice(PREFIX)} ${choice(CORE)}`

const RETRY_KEYS = ['r1', 'r2', 'r3', 'r4', 'r5']
const SUM_KEYS = ['dialed', 'connected', 'not_connected', 'first_attempt',
  ...RETRY_KEYS, 'retry_exhausted', 'next_retry_scheduled']
const blankAgg = () => Object.fromEntries(SUM_KEYS.map(k => [k, 0]))
const addInto = (agg, row) => { for (const k of SUM_KEYS) agg[k] += row[k] }
function finalize(agg) {
  const d = agg.dialed
  agg.connect_pct = d ? +(agg.connected / d * 100).toFixed(2) : 0
  agg.connect_lift_pct = d ? +((agg.connected - agg.first_attempt) / d * 100).toFixed(2) : 0
  return agg
}

function genCampaign(cid, retryEnabled) {
  const dialed = choice([randint(80, 600), randint(600, 3000), randint(3000, 20000)])
  const p0 = uniform(0.18, 0.42)
  const firstAttempt = Math.round(dialed * p0)
  let unconn = dialed - firstAttempt
  const r = [0, 0, 0, 0, 0]
  let mode = null, configured = 0, nextSched = 0

  if (retryEnabled) {
    mode = rnd() < 0.6 ? 'immediate' : 'schedule'
    configured = weighted([1, 2, 3, 4, 5], [12, 40, 24, 14, 10])
    let pool = unconn
    for (let i = 0; i < configured; i++) {
      const rate = RETRY_WAVE_RATES[i] * uniform(0.8, 1.2)
      const connects = Math.round(pool * rate)
      r[i] = connects; pool -= connects
    }
    if (rnd() < 0.12 && pool > 0) nextSched = Math.round(pool * uniform(0.1, 0.4))
  }

  const connected = firstAttempt + r.reduce((s, x) => s + x, 0)
  const notConnected = dialed - connected
  const retryExhausted = clamp(notConnected - nextSched, 0, notConnected)
  return {
    campaign_id: cid,
    retry_enabled: retryEnabled ? 1 : 0,
    mode,
    configured_retries: configured,
    dialed,
    connected,
    not_connected: notConnected,
    first_attempt: firstAttempt,
    r1: r[0], r2: r[1], r3: r[2], r4: r[3], r5: r[4],
    retry_exhausted: retryExhausted,
    next_retry_scheduled: nextSched,
    connect_pct: dialed ? +(connected / dialed * 100).toFixed(2) : 0,
    connect_lift_pct: dialed ? +((connected - firstAttempt) / dialed * 100).toFixed(2) : 0,
  }
}

const accounts = {}
const campaignsByInst = {}
const byInstitution = []
const byServerMap = {}
const globalAgg = blankAgg()

let voiceCampaigns = 0, retryCampaigns = 0, modeImmediate = 0, modeScheduled = 0
let dialedTotal = 0, retryInstitutions = 0
const retryCountDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

const baseId = 5001
for (let n = 0; n < N_INSTITUTIONS; n++) {
  const instId = baseId + n
  accounts[instId] = makeName()
  const server = choice(SERVERS)
  const adopter = rnd() < 0.58
  const nCampaigns = randint(1, 34)

  const instElig = blankAgg()
  const instRaw = blankAgg()
  let instRetryCampaigns = 0
  const configuredSeen = []
  const modeCounts = { immediate: 0, schedule: 0 }
  const rows = []

  for (let c = 0; c < nCampaigns; c++) {
    const cid = instId * 1000 + c
    const retryOn = adopter && rnd() < 0.65
    const row = genCampaign(cid, retryOn)
    rows.push(row)
    voiceCampaigns++
    dialedTotal += row.dialed
    addInto(instRaw, row)
    if (row.retry_enabled) {
      retryCampaigns++; instRetryCampaigns++
      modeCounts[row.mode]++
      configuredSeen.push(row.configured_retries)
      retryCountDist[row.configured_retries]++
      if (row.mode === 'immediate') modeImmediate++; else modeScheduled++
      addInto(instElig, row)
      addInto(globalAgg, row)
    }
  }

  rows.sort((a, b) => b.dialed - a.dialed)
  campaignsByInst[instId] = rows

  const hasRetry = instRetryCampaigns > 0
  if (hasRetry) retryInstitutions++
  const dominantMode = hasRetry
    ? (modeCounts.immediate >= modeCounts.schedule ? 'immediate' : 'schedule') : null
  const avgConf = configuredSeen.length
    ? +(configuredSeen.reduce((s, x) => s + x, 0) / configuredSeen.length).toFixed(1) : 0

  finalize(instElig)
  byInstitution.push({
    ...instElig,
    institution_id: instId,
    server,
    campaigns: nCampaigns,
    retry_enabled_campaigns: instRetryCampaigns,
    retry_enabled: hasRetry,
    dominant_mode: dominantMode,
    avg_configured_retries: avgConf,
    dialed_raw: instRaw.dialed,
    first_attempt_raw: instRaw.first_attempt,
  })

  const srv = byServerMap[server] ?? (byServerMap[server] = {
    ...blankAgg(), server, institutions: new Set(), campaigns: 0, retry_campaigns: 0,
  })
  srv.institutions.add(instId)
  srv.campaigns += nCampaigns
  srv.retry_campaigns += instRetryCampaigns
  addInto(srv, instElig)
}

finalize(globalAgg)

const byServer = Object.values(byServerMap).map(srv => {
  srv.institutions = srv.institutions.size
  return finalize(srv)
}).sort((a, b) => a.server.localeCompare(b.server))

const scaled = (frac, jitter) => {
  const a = blankAgg()
  for (const k of SUM_KEYS) a[k] = Math.floor(globalAgg[k] * frac * jitter)
  return finalize(a)
}
const periods = [
  { date_range: '23jun26-6jul26', global: scaled(0.30, 0.94) },
  { date_range: '7jul26-21jul26', global: scaled(0.70, 1.03) },
]

const adoption = {
  voice_institutions: N_INSTITUTIONS,
  retry_institutions: retryInstitutions,
  voice_campaigns: voiceCampaigns,
  retry_campaigns: retryCampaigns,
  mode_immediate: modeImmediate,
  mode_scheduled: modeScheduled,
  retry_count_dist: Object.fromEntries(Object.entries(retryCountDist).map(([k, v]) => [k, v])),
  dialed_retry: globalAgg.dialed,
  dialed_total: dialedTotal,
}

const summary = {
  extracted_date: EXTRACTED_DATE,
  synthetic: true,
  adoption,
  global: globalAgg,
  periods,
  by_server: byServer,
  by_institution: byInstitution,
}

mkdirSync(join(ROOT, 'src', 'data'), { recursive: true })
writeFileSync(OUT_SUMMARY, JSON.stringify(summary))
writeFileSync(OUT_ACCOUNTS, JSON.stringify(accounts))
mkdirSync(OUT_CAMPAIGNS, { recursive: true })
for (const f of readdirSync(OUT_CAMPAIGNS)) if (f.endsWith('.json')) rmSync(join(OUT_CAMPAIGNS, f))
for (const [instId, rows] of Object.entries(campaignsByInst)) {
  writeFileSync(join(OUT_CAMPAIGNS, `${instId}.json`), JSON.stringify(rows))
}

console.log(`Institutions: ${N_INSTITUTIONS}  (retry adopters: ${retryInstitutions})`)
console.log(`Campaigns: ${voiceCampaigns}  (retry-enabled: ${retryCampaigns})`)
console.log(`Dialed (retry campaigns): ${globalAgg.dialed.toLocaleString()}`)
console.log(`Connect rate: ${globalAgg.connect_pct}%   Connect lift: +${globalAgg.connect_lift_pct}%`)
console.log(`Wrote summary.json, accounts.json, ${Object.keys(campaignsByInst).length} campaign files`)
