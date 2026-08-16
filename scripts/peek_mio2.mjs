/** Determine grain + fill-rates of MIO_Voice.csv key fields (first ~40MB). */
import { createReadStream } from 'node:fs'
const FILE = 'C:/Users/Kartik/Downloads/MIO_Voice.csv'

function makeParser(onRow) {
  let field = '', row = [], inQ = false
  return chunk => {
    for (const ch of chunk) {
      if (inQ) { if (ch === '"') inQ = false; else field += ch }
      else if (ch === '"') inQ = true
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\n') { row.push(field); onRow(row); row = []; field = '' }
      else if (ch !== '\r') field += ch
    }
  }
}

let header = null, idx = {}, n = 0, done = false
const fill = {}, distinct = { source_db: new Set(), tenant_id: new Set(), voice_broadcasting_type: new Set() }
const KEYS = ['lead_id','campaign_name','configured_retry_count','retry_history','uniqid','call_id','execution_id','run_id','name','answered','status','retry_count']
const samples = []
const stream = createReadStream(FILE, { encoding: 'utf8', start: 0, end: 40_000_000 })
const parse = makeParser(row => {
  if (done) return
  if (!header) { header = row.map(h => h.replace(/^\uFEFF/,'').replace(/^"|"$/g,'')); header.forEach((h,i)=>idx[h]=i); KEYS.forEach(k=>fill[k]=0); return }
  n++
  const g = k => row[idx[k]] ?? ''
  for (const k of KEYS) if (g(k) !== '') fill[k]++
  for (const k of Object.keys(distinct)) if (distinct[k].size < 60) distinct[k].add(g(k))
  if (samples.length < 8 && g('retry_history') && g('retry_history') !== '[]')
    samples.push({ uniqid:g('uniqid'), call_id:g('call_id'), name:g('name'), clog:g('communication_log_id'),
      retry_count:g('retry_count'), cfg:g('configured_retry_count'), answered:g('answered'), status:g('status'),
      rh:g('retry_history').slice(0,120) })
  if (n >= 200000) { done = true; stream.destroy() }
})
stream.on('data', d => !done && parse(d))
stream.on('error', e => { if (!done) console.error(e) })
stream.on('close', () => {
  console.log(`rows scanned: ${n}\n`)
  console.log('FILL RATES:')
  for (const k of KEYS) console.log(`  ${k.padEnd(22)} ${(fill[k]/n*100).toFixed(1)}%  (${fill[k]})`)
  console.log('\nDISTINCT source_db:', [...distinct.source_db])
  console.log('DISTINCT tenant_id (sample):', [...distinct.tenant_id].slice(0,30))
  console.log('DISTINCT voice_broadcasting_type:', [...distinct.voice_broadcasting_type])
  console.log('\nSAMPLE rows with retry_history:')
  for (const s of samples) console.log(' ', JSON.stringify(s))
})
