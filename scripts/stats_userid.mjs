/** Investigate user_id (lead key) in MIO_Voice.csv for unique-lead modelling. */
import { createReadStream } from 'node:fs'
const FILE = 'C:/Users/Kartik/Downloads/MIO_Voice.csv'
const NEED = ['user_id', 'tenant_id', 'communication_log_id', 'answered', 'status', 'retry_count', 'lead_id', 'uniqid']

let header = null, needIdx = null, fieldIdx = 0, cur = '', inQ = false, pending = false, rowVals = {}, hdr = []
let n = 0, emptyUser = 0, emptyLead = 0, attempts = 0
const leads = new Set()           // tenant|user
const leadPerCamp = new Set()     // tenant|clog|user
const connectedLeads = new Set()  // tenant|user with any connect
const t0 = Date.now()

function onRow(v) {
  n++
  const user = v.user_id || '', ten = v.tenant_id || '', clog = v.communication_log_id || ''
  if (!user) emptyUser++
  if (!(v.lead_id || '')) emptyLead++
  const rc = parseInt(v.retry_count, 10); attempts += (!rc || rc < 1) ? 1 : rc
  if (user) {
    const lk = ten + '\u0001' + user
    leads.add(lk)
    leadPerCamp.add(ten + '\u0001' + clog + '\u0001' + user)
    if (v.answered === '1' || v.status === 'completed' || v.status === 'answered') connectedLeads.add(lk)
  }
}

const endField = () => { if (header) { const k = needIdx[fieldIdx]; if (k) rowVals[k] = cur } else hdr.push(cur); cur = ''; fieldIdx++ }
const endRow = () => {
  endField()
  if (!header) { header = hdr.map(h => h.replace(/^\uFEFF/, '').replace(/^"|"$/g, '')); needIdx = {}; header.forEach((h, i) => { if (NEED.includes(h)) needIdx[i] = h }) }
  else { onRow(rowVals); rowVals = {}; if (n % 1000000 === 0) console.log(`  ${(n/1e6).toFixed(0)}M rows · ${((Date.now()-t0)/1000).toFixed(0)}s · uniqueLeads=${leads.size}`) }
  fieldIdx = 0
}
const need = () => !header || needIdx[fieldIdx]
function feed(c) {
  for (let k = 0; k < c.length; k++) {
    const ch = c[k]
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
  console.log('\n── user_id analysis ─────────────────────')
  console.log(`total rows:            ${n.toLocaleString()}`)
  console.log(`user_id empty:         ${emptyUser.toLocaleString()} (${(emptyUser/n*100).toFixed(1)}%)`)
  console.log(`lead_id empty:         ${emptyLead.toLocaleString()} (${(emptyLead/n*100).toFixed(1)}%)`)
  console.log(`unique leads (ten|user):        ${leads.size.toLocaleString()}`)
  console.log(`unique lead-per-campaign:        ${leadPerCamp.size.toLocaleString()}`)
  console.log(`→ rows per unique lead:          ${(n/leads.size).toFixed(2)}`)
  console.log(`→ campaigns per unique lead:     ${(leadPerCamp.size/leads.size).toFixed(2)}`)
  console.log(`unique connected leads:          ${connectedLeads.size.toLocaleString()}`)
  console.log(`LEAD-WISE connect rate:          ${(connectedLeads.size/leads.size*100).toFixed(2)}%`)
  console.log(`total attempts (sum retry_count):${attempts.toLocaleString()}   avg attempts/lead: ${(attempts/leads.size).toFixed(2)}`)
}).on('error', e => { console.error(e); process.exit(1) })
