/**
 * Emits the 4 data-request tables as CSV templates (header + example rows).
 *   node scripts/build_csv_templates.mjs
 */
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTDIR = resolve(__dirname, '../data-request-csv')
mkdirSync(OUTDIR, { recursive: true })

const cell = v => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
const toCSV = rows => rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n'
const write = (name, rows) => {
  const p = resolve(OUTDIR, name)
  writeFileSync(p, toCSV(rows), 'utf8')
  console.log('wrote', name, '·', rows.length - 1, 'example row(s)')
}

// 1. CALL FACTS  (retry_mode & configured_retries dropped — not available at job level yet)
write('1_call_facts.csv', [
  ['date','college_id','college_name','instance','campaign_id','campaign_name','agent_id','agent_name',
   'retry_enabled','unique_contacts_dialed','calls_attempted','connected_first',
   'connected_r1','connected_r2','connected_r3','connected_r4','connected_r5','retry_exhausted','retry_scheduled'],
  ['2026-06-23',5001,'Sunrise College of Arts & Science','in11',5001001,'June Intake - UG Calling','AG002','Priya Nair',1,1820,3860,540,190,82,14,0,0,970,24],
  ['2026-06-23',5001,'Sunrise College of Arts & Science','in11',5001002,'MBA Lateral - Reminder','AG005','Vikram Singh',1,640,1320,150,61,20,0,0,0,402,7],
  ['2026-06-23',5003,'Lotus College of Management','in11',5003001,'Scholarship Follow-up','AG011','Aria (Bot)',0,900,900,240,0,0,0,0,0,0,0],
  ['2026-06-24',5001,'Sunrise College of Arts & Science','in11',5001001,'June Intake - UG Calling','AG002','Priya Nair',1,1610,3410,470,175,70,11,0,0,860,24],
])

// 2. CAMPAIGN MASTER  (retry_mode & configured_retries dropped — not available at job level yet)
write('2_campaign_master.csv', [
  ['college_id','college_name','instance','campaign_id','campaign_name','agent_id','agent_name','retry_enabled',
   'total_unique_contacts_alltime','total_calls_alltime','connected_first_alltime','launch_date','status'],
  [5001,'Sunrise College of Arts & Science','in11',5001001,'June Intake - UG Calling','AG002','Priya Nair',1,47912,101540,13035,'2026-06-10','running'],
  [5001,'Sunrise College of Arts & Science','in11',5001002,'MBA Lateral - Reminder','AG005','Vikram Singh',1,18400,37220,4700,'2026-06-15','running'],
  [5003,'Lotus College of Management','in11',5003001,'Scholarship Follow-up','AG011','Aria (Bot)',0,62450,62450,16820,'2026-05-28','completed'],
])

// 3. COLLEGE MASTER
write('3_college_master.csv', [
  ['college_id','college_name','instance','region','voice_enabled'],
  [5001,'Sunrise College of Arts & Science','in11','South',1],
  [5003,'Lotus College of Management','in11','West',1],
])

// 4. AGENT MASTER
write('4_agent_master.csv', [
  ['agent_id','agent_name','team','college_id','active'],
  ['AG002','Priya Nair','Admissions - South',5001,1],
  ['AG005','Vikram Singh','Admissions - West','',1],
  ['AG011','Aria (Bot)','Shared',''  ,1],
])

console.log('\nCSV templates in:', OUTDIR)
