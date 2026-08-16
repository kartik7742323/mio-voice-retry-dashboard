/** Build src/data/accounts.json (college id → name) from Downloads/Accounts.csv. */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = 'C:/Users/Kartik/Downloads/Accounts.csv'

// minimal CSV line splitter (quotes + embedded commas)
function splitCSV(line) {
  const out = []; let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQ) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++ } else inQ = false } else cur += ch }
    else if (ch === '"') inQ = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

const text = readFileSync(SRC, 'utf8').replace(/^\uFEFF/, '')
const lines = text.split(/\r?\n/).filter(l => l.length)
const header = splitCSV(lines[0]).map(h => h.trim())
const idIdx = header.indexOf('id'), nameIdx = header.indexOf('name'), infraIdx = header.indexOf('infra')

const byId = new Map()          // id -> name (last wins)
const byIdInfra = new Map()     // `${id}|${infra}` -> name
let dupIds = 0
for (let i = 1; i < lines.length; i++) {
  const f = splitCSV(lines[i])
  const id = (f[idIdx] || '').trim()
  const name = (f[nameIdx] || '').trim()
  const infra = (f[infraIdx] || '').trim()
  if (!id || !name) continue
  if (byId.has(id) && byId.get(id) !== name) dupIds++
  byId.set(id, name)
  byIdInfra.set(`${id}|${infra}`, name)
}

// match against the dashboard's colleges
const summary = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'summary.json'), 'utf8'))
const accounts = {}
let matched = 0, unmatched = []
for (const inst of summary.by_institution) {
  const id = String(inst.institution_id)
  // prefer id+infra match, fall back to id
  const name = byIdInfra.get(`${id}|${inst.server}`) || byId.get(id)
  if (name) { accounts[id] = name; matched++ }
  else unmatched.push(`${id}(${inst.server})`)
}

writeFileSync(join(ROOT, 'src', 'data', 'accounts.json'), JSON.stringify(accounts))
console.log(`Accounts.csv rows: ${byId.size} ids  (duplicate-id-different-name: ${dupIds})`)
console.log(`dashboard colleges: ${summary.by_institution.length}`)
console.log(`matched to a name:  ${matched}`)
console.log(`unmatched (${unmatched.length}): ${unmatched.slice(0, 20).join(', ')}${unmatched.length > 20 ? ' …' : ''}`)
console.log('sample:', Object.entries(accounts).slice(0, 6).map(([k, v]) => `${k}=${v}`))
