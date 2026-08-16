/** Peek at key columns of the big MIO_Voice.csv without loading it all. */
import { createReadStream } from 'node:fs'

const FILE = 'C:/Users/Kartik/Downloads/MIO_Voice.csv'
const WANT = ['_mongo_db','_mongo_alias','source_db','tenant_id','communication_log_id','agent_id',
  'campaign_name','lead_id','call_type','dialed','answered','busy','failed','unanswered','missed',
  'status','retry_count','configured_retry_count','retried','retry_history','voice_broadcasting_type',
  'added_on','vendor','name']
const MAXROWS = 25

// tiny streaming CSV parser (handles quotes + embedded commas/newlines)
function makeParser(onRow) {
  let field = '', row = [], inQ = false, prev = ''
  return chunk => {
    for (const ch of chunk) {
      if (inQ) {
        if (ch === '"') inQ = false
        else field += ch
      } else if (ch === '"') inQ = true
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\n') { row.push(field); onRow(row); row = []; field = '' }
      else if (ch === '\r') { /* skip */ }
      else field += ch
    }
  }
}

let header = null, count = 0, done = false
const idx = {}
const stream = createReadStream(FILE, { encoding: 'utf8', start: 0, end: 3_000_000 })
const parse = makeParser(row => {
  if (done) return
  if (!header) {
    header = row.map(h => h.replace(/^\uFEFF/, '').replace(/^"|"$/g, ''))
    header.forEach((h, i) => { idx[h] = i })
    return
  }
  count++
  const rec = {}
  for (const k of WANT) rec[k] = row[idx[k]] ?? ''
  console.log(`\n#${count}`)
  for (const k of WANT) {
    let v = rec[k]
    if (v && v.length > 60) v = v.slice(0, 57) + '...'
    if (v !== '') console.log(`  ${k.padEnd(24)} ${v}`)
  }
  if (count >= MAXROWS) { done = true; stream.destroy() }
})
stream.on('data', d => !done && parse(d))
stream.on('close', () => console.log(`\n(parsed ${count} rows)`))
stream.on('error', e => { if (!done) console.error(e) })
