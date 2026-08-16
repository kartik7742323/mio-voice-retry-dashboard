/** Resolve live-client Project names/ids → dashboard college (tenant) ids. */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = 'C:/Users/Kartik/Downloads/Projects_MIO (2).csv'

function splitCSV(line) {
  const out = []; let cur = '', q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += ch }
    else if (ch === '"') q = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur); return out
}
const norm = s => String(s || '').toLowerCase()
  .replace(/&/g, 'and').replace(/[.,'()\-–—_/]/g, ' ')
  .replace(/\s+/g, ' ').trim()

const text = readFileSync(SRC, 'utf8').replace(/^\uFEFF/, '')
const lines = text.split(/\r?\n/).filter(l => l.trim().length)
const H = splitCSV(lines[0]).map(h => h.trim())
const iName = H.indexOf('Project Name'), iCollexo = H.indexOf('Collexo Institute ID'),
  iMeritto = H.indexOf('Meritto ID'), iStatus = H.indexOf('Status')

const projects = []
let collexoFill = 0, merittoFill = 0
for (let i = 1; i < lines.length; i++) {
  const f = splitCSV(lines[i])
  const name = (f[iName] || '').trim()
  if (!name) continue
  const collexo = (f[iCollexo] || '').trim(), meritto = (f[iMeritto] || '').trim()
  if (collexo) collexoFill++; if (meritto) merittoFill++
  projects.push({ name, collexo, meritto, status: (f[iStatus] || '').trim() })
}

// dashboard colleges
const accounts = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'accounts.json'), 'utf8'))
const summary = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'summary.json'), 'utf8'))
const dashIds = new Set(summary.by_institution.map(i => i.institution_id))
const nameToId = new Map()
for (const [id, nm] of Object.entries(accounts)) nameToId.set(norm(nm), Number(id))

const dashList = Object.entries(accounts).map(([id, nm]) => ({ id: Number(id), n: norm(nm), nm }))
const allowed = new Set(); const matched = [], unmatched = []
for (const p of projects) {
  let id = null, how = null
  const pn = norm(p.name)
  if (p.meritto && dashIds.has(Number(p.meritto))) { id = Number(p.meritto); how = 'merittoID' }
  else if (p.collexo && dashIds.has(Number(p.collexo))) { id = Number(p.collexo); how = 'collexoID' }
  else if (nameToId.has(pn)) { id = nameToId.get(pn); how = 'name-exact' }
  else {
    // variant: one normalized name fully contains the other (e.g. "Medicaps University" ⊂ "Medicaps University, Indore")
    let best = null
    for (const d of dashList) {
      if (d.n.length < 5 || pn.length < 5) continue
      if (d.n.includes(pn) || pn.includes(d.n)) {
        const score = Math.min(d.n.length, pn.length)
        if (!best || score > best.score) best = { id: d.id, score, nm: d.nm }
      }
    }
    if (best) { id = best.id; how = `name-variant → ${best.nm}` }
  }
  if (id != null) { allowed.add(id); matched.push(`${id} ← ${p.name} [${how}]`) }
  else unmatched.push(p.name)
}

writeFileSync(join(ROOT, 'scripts', '_live_ids.json'), JSON.stringify([...allowed]))
console.log(`projects: ${projects.length}   Collexo-ID filled: ${collexoFill}   Meritto-ID filled: ${merittoFill}`)
console.log(`matched to dashboard colleges: ${allowed.size}`)
console.log(`unmatched live clients (no call data / name mismatch): ${unmatched.length}`)
console.log('\n--- matched ---'); matched.slice(0, 100).forEach(m => console.log('  ' + m))
console.log('\n--- unmatched ---'); unmatched.forEach(u => console.log('  ' + u))
