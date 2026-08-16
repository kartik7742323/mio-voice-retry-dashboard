/**
 * Builds Mio_Retry_Dashboard_DataRequest.xlsx — the data-request workbook that
 * tells the tech/data team exactly what columns to send so every dashboard
 * metric, chart, table and drill-down renders with real data.
 *
 *   node scripts/build_datarequest.mjs
 */
import * as XLSX from 'xlsx'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../Mio_Retry_Dashboard_DataRequest.xlsx')

const wb = XLSX.utils.book_new()
const add = (name, aoa, cols) => {
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  if (cols) ws['!cols'] = cols.map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws, name)
  return ws
}
const w = (...a) => a  // width helper alias

// ───────────────────────────────────────────────────────────── READ ME
const readme = [
  ['MIO AI VOICE — RETRY ADOPTION & CONNECT-RATE DASHBOARD  ·  DATA REQUEST'],
  ['What to send so every metric, chart, table and drill-down renders with real data. Prepared for the Mio tech / data team.'],
  [],
  ['HOW TO USE'],
  ['Fill the four template tabs (1–4). Tabs 1 & 2 are the data; tabs 3 & 4 are small lookups.'],
  ['One workbook per extraction window is fine, or send one continuous CALL FACTS file — the date column drives the range picker.'],
  [],
  ['THE 4 TABLES'],
  ['1. CALL FACTS', 'THE core table. One row per (date × college × campaign × agent) with retry-attempt outcome counts.'],
  ['', 'Drives ALL connect-rate metrics, every chart, the funnel, Period Comparison, and all College / Agent / Date filtering.'],
  ['', 'Include BOTH retry-on and retry-off campaigns.'],
  ['2. CAMPAIGN MASTER', 'One row per campaign (job), including retry-OFF ones. Config + all-time dialed.'],
  ['', 'Drives Feature Adoption counts, retry-count distribution, mode split, and the "No Adoption (RISK)" table.'],
  ['3. COLLEGE MASTER', 'One row per college/client. Names, instance/server, voice_enabled flag (adoption denominator + College dropdown).'],
  ['4. AGENT MASTER', 'One row per agent. Names for the Agent dropdown & agent-wise labels. (See decision #1 on what "agent" means.)'],
  [],
  ['GRANULARITY = FILTERS'],
  ['Because CALL FACTS is broken down by college, campaign, agent AND date, the dashboard can recompute every KPI for any'],
  ['combination of the three global filters, and drill from a client down to each individual campaign (job).'],
  [],
  ['DERIVED — DO NOT SEND'],
  ['The dashboard computes these itself: connected (= 1st + r1..r5), not_connected (= dialed − connected),'],
  ['connect_pct, connect_lift_pct, and all cumulative / percentage chart values.'],
  [],
  ['KEY INVARIANT'],
  ['Within any CALL FACTS row:  connected_first + connected_r1..r5  ≤  dialed.'],
  ['The retry index is the CONNECTING attempt (0 = answered on the 1st call, N = answered on the Nth retry).'],
  [],
  ['✔ DECISIONS — LOCKED  (confirmed by product, 11-Aug-2026)'],
  ['1 · Agent', 'Agent = the AI voice bot agent. One agent initiates each campaign and every call is linked to it → the Agent filter is REAL and on every CALL FACTS row.'],
  ['2 · Dialed', 'TWO measures needed: unique_contacts_dialed (distinct leads) AND calls_attempted (total attempts — a contact may have up to configured_retries+1 attempts).'],
  ['3 · Date', 'Every call attempt carries its own date, connected or not. Attempts land on their own day; a connect is credited to the connecting-attempt date.'],
  ['4 · Connected', 'answered==1 OR status==completed, and "completed" INCLUDES voicemail / call-disconnected.'],
  ['5 · All-time', 'CAMPAIGN MASTER carries BOTH total_unique_contacts_alltime and total_calls_alltime. Connect rate uses unique contacts as the denominator.'],
  ['6 · In-flight', 'A not-yet-connected lead with a pending retry is counted as "Retry Scheduled" (its own status), reported via the retry_scheduled column.'],
  [],
  ['NOTE ON GRAIN / VOLUME'],
  ['The templates expect data pre-aggregated to the daily grain (that keeps the file inside Excel\'s ~1,048,576-row limit).'],
  ['If you would rather export the RAW call log (one row per attempt), send it as CSV or a DB dump — NOT Excel — and the pipeline will aggregate it. Schema for that is the same fields minus the day roll-up.'],
  ['Caveat on unique contacts across a date range: attribute each contact to the day of its FIRST attempt so daily sums approximate distinct contacts; the exact all-time unique count lives in CAMPAIGN MASTER.'],
  [],
  ['SEE ALSO'],
  ['"FIELD DICTIONARY" tab = every column, type, required?, description, example.'],
  ['"METRIC → SOURCE MAP" tab = every dashboard element mapped to its source table, columns and formula.'],
]
add('READ ME', readme, w(24, 105))

// ───────────────────────────────────────────────────────────── 1. CALL FACTS
const callHeaders = ['date','college_id','college_name','instance','campaign_id','campaign_name','agent_id','agent_name',
  'retry_enabled','retry_mode','configured_retries','unique_contacts_dialed','calls_attempted','connected_first','connected_r1','connected_r2',
  'connected_r3','connected_r4','connected_r5','retry_exhausted','retry_scheduled']
const callFacts = [
  ['1. CALL FACTS  —  PRIMARY TABLE · one row per (date × college × campaign × agent) · include retry-ON and retry-OFF campaigns'],
  ['◀ EXAMPLE ROWS below (delete before filling). retry index = the CONNECTING attempt (0 = 1st call, N = Nth retry). connected_first + r1..r5 ≤ unique_contacts_dialed ≤ calls_attempted. Leave connected / not_connected / connect% out — the dashboard derives them.'],
  [],
  callHeaders,
  ['2026-06-23',5001,'Sunrise College of Arts & Science','in11',5001001,'June Intake – UG Calling','AG002','Priya Nair',1,'immediate',3,1820,3860,540,190,82,14,0,0,970,24],
  ['2026-06-23',5001,'Sunrise College of Arts & Science','in11',5001002,'MBA Lateral – Reminder','AG005','Vikram Singh',1,'schedule',2,640,1320,150,61,20,0,0,0,402,7],
  ['2026-06-23',5003,'Lotus College of Management','in11',5003001,'Scholarship Follow-up','AG011','Aria (Bot)',0,'',0,900,900,240,0,0,0,0,0,0,0],
  ['2026-06-24',5001,'Sunrise College of Arts & Science','in11',5001001,'June Intake – UG Calling','AG002','Priya Nair',1,'immediate',3,1610,3410,470,175,70,11,0,0,860,24],
]
add('1. CALL FACTS', callFacts, w(12,11,30,9,13,26,12,16,13,12,15,16,14,14,13,13,13,13,13,15,15))

// ───────────────────────────────────────────────────────────── 2. CAMPAIGN MASTER
const campHeaders = ['college_id','college_name','instance','campaign_id','campaign_name','agent_id','agent_name','retry_enabled','retry_mode',
  'configured_retries','total_unique_contacts_alltime','total_calls_alltime','connected_first_alltime','launch_date','status']
const campMaster = [
  ['2. CAMPAIGN MASTER  —  one row per campaign (job) · INCLUDE retry-OFF campaigns · powers adoption, mode split, retry-count distribution & No-Adoption-Risk'],
  ['◀ EXAMPLE ROWS below (delete before filling). total_unique_contacts_alltime = all-time distinct leads (connect-rate denominator + risk buckets); total_calls_alltime = all-time attempts. retry_mode / configured_retries blank when retry_enabled = 0.'],
  [],
  campHeaders,
  [5001,'Sunrise College of Arts & Science','in11',5001001,'June Intake – UG Calling','AG002','Priya Nair',1,'immediate',3,47912,101540,13035,'2026-06-10','running'],
  [5001,'Sunrise College of Arts & Science','in11',5001002,'MBA Lateral – Reminder','AG005','Vikram Singh',1,'schedule',2,18400,37220,4700,'2026-06-15','running'],
  [5003,'Lotus College of Management','in11',5003001,'Scholarship Follow-up','AG011','Aria (Bot)',0,'',0,62450,62450,16820,'2026-05-28','completed'],
]
add('2. CAMPAIGN MASTER', campMaster, w(11,30,9,13,28,12,16,13,12,15,22,18,20,13,12))

// ───────────────────────────────────────────────────────────── 3. COLLEGE MASTER
const collegeMaster = [
  ['3. COLLEGE MASTER  —  one row per college/client · names + instance + voice_enabled (adoption denominator & College dropdown)'],
  ['◀ EXAMPLE ROWS below (delete before filling). voice_enabled = 1 for any college live on Mio AI Voice (whether or not retry is on).'],
  [],
  ['college_id','college_name','instance','region','voice_enabled'],
  [5001,'Sunrise College of Arts & Science','in11','South',1],
  [5003,'Lotus College of Management','in11','West',1],
]
add('3. COLLEGE MASTER', collegeMaster, w(11,34,9,16,13))

// ───────────────────────────────────────────────────────────── 4. AGENT MASTER
const agentMaster = [
  ['4. AGENT MASTER  —  one row per agent · names for the Agent dropdown & agent-wise labels (confirm what "agent" maps to — decision #1)'],
  ['◀ EXAMPLE ROWS below (delete before filling). college_id optional — fill only if an agent belongs to one college; blank if global.'],
  [],
  ['agent_id','agent_name','team','college_id','active'],
  ['AG002','Priya Nair','Admissions – South',5001,1],
  ['AG005','Vikram Singh','Admissions – West','',1],
]
add('4. AGENT MASTER', agentMaster, w(12,22,20,12,10))

// ───────────────────────────────────────────────────────────── FIELD DICTIONARY
const fd = [
  ['FIELD DICTIONARY  —  every column across the 4 tables'],
  [],
  ['Table','Column','Type','Required','Description','Example'],
  ['CALL FACTS','date','Date','Yes','Calendar date dials/attempts occurred (decision #3 for retry connects). Drives date filter & Period Comparison.','2026-06-23'],
  ['CALL FACTS','college_id','Integer','Yes','Client identifier. Joins to COLLEGE MASTER.','5001'],
  ['CALL FACTS','college_name','Text','Rec.','Display name (can resolve from master instead).','Sunrise College…'],
  ['CALL FACTS','instance','Text','Yes','Server / DB instance the college sits on.','in11'],
  ['CALL FACTS','campaign_id','Int/Text','Yes','Campaign (job) id. Joins to CAMPAIGN MASTER. Enables client→job drill-down.','5001001'],
  ['CALL FACTS','campaign_name','Text','Rec.','Display name of the campaign/job.','June Intake – UG Calling'],
  ['CALL FACTS','agent_id','Int/Text','Yes','Agent id. Use "UNASSIGNED" if none (decision #1). Joins to AGENT MASTER.','AG002'],
  ['CALL FACTS','agent_name','Text','Rec.','Agent display name.','Priya Nair'],
  ['CALL FACTS','retry_enabled','0/1','Yes','Was retry on for this campaign at dial time.','1'],
  ['CALL FACTS','retry_mode','Text','If on','immediate | schedule. Blank when retry off. Feeds mode split.','immediate'],
  ['CALL FACTS','configured_retries','0–5','Yes','Max retries configured. Feeds retry-count distribution.','3'],
  ['CALL FACTS','unique_contacts_dialed','Integer','Yes','Distinct leads dialed in this row (decision #2). Connect-rate denominator.','1820'],
  ['CALL FACTS','calls_attempted','Integer','Yes','Total call attempts in this row incl. retries (≥ unique_contacts_dialed).','3860'],
  ['CALL FACTS','connected_first','Integer','Yes','Distinct contacts connected on the 1st call (retry index 0). "Completed" incl. voicemail/disconnected.','540'],
  ['CALL FACTS','connected_r1','Integer','Yes','Distinct contacts connected on retry 1.','190'],
  ['CALL FACTS','connected_r2 … r5','Integer','Yes','Distinct contacts connected on retries 2–5 (one column each).','82 / 14 / 0 / 0'],
  ['CALL FACTS','retry_exhausted','Integer','Yes','Not connected AND all configured retries used up.','970'],
  ['CALL FACTS','retry_scheduled','Integer','Yes','Not connected yet, a retry still pending (in-flight status, decision #6).','24'],
  ['CAMPAIGN MASTER','campaign_id','Int/Text','Yes','One row per campaign, INCLUDING retry-off ones.','5001001'],
  ['CAMPAIGN MASTER','agent_id / agent_name','Int/Text','Yes','The AI voice bot agent that initiated the campaign.','AG002 / Priya Nair'],
  ['CAMPAIGN MASTER','retry_enabled','0/1','Yes','Retry on/off. Drives "Campaigns on Retry" & RISK table.','1'],
  ['CAMPAIGN MASTER','retry_mode','Text','If on','immediate | schedule. Drives the mode-split donut.','immediate'],
  ['CAMPAIGN MASTER','configured_retries','0–5','Yes','Drives the "Configured Retry Count" bar chart.','3'],
  ['CAMPAIGN MASTER','total_unique_contacts_alltime','Integer','Yes','All-time distinct leads. Connect-rate denominator + RISK bucket size.','47912'],
  ['CAMPAIGN MASTER','total_calls_alltime','Integer','Yes','All-time total attempts (a contact can have several).','101540'],
  ['CAMPAIGN MASTER','connected_first_alltime','Integer','Yes','All-time connected on 1st call. RISK-table column for non-adopters.','13035'],
  ['CAMPAIGN MASTER','launch_date / status','Date / Text','Opt.','Context only.','2026-06-10 / running'],
  ['COLLEGE MASTER','college_id','Integer','Yes','Primary key.','5001'],
  ['COLLEGE MASTER','college_name','Text','Yes','Display name (College dropdown, tables).','Sunrise College…'],
  ['COLLEGE MASTER','instance','Text','Yes','Server / DB instance.','in11'],
  ['COLLEGE MASTER','region','Text','Opt.','Optional grouping.','South'],
  ['COLLEGE MASTER','voice_enabled','0/1','Yes','College is live on AI Voice. Denominator for "Institutes on Retry".','1'],
  ['AGENT MASTER','agent_id','Int/Text','Yes','Primary key. Matches CALL FACTS.agent_id.','AG002'],
  ['AGENT MASTER','agent_name','Text','Yes','Display name (Agent dropdown).','Priya Nair'],
  ['AGENT MASTER','team / college_id / active','Text/Int/0-1','Opt.','Optional grouping, ownership, active flag.','Admissions–South / 5001 / 1'],
]
add('FIELD DICTIONARY', fd, w(18,22,13,10,64,24))

// ───────────────────────────────────────────────────────────── METRIC → SOURCE MAP
const ms = [
  ['METRIC → SOURCE MAP  —  every element on the dashboard and how it is built'],
  [],
  ['Screen','Element','Source table(s)','Source column(s)','Aggregation / formula'],
  ['Overview · KPIs','Leads Dialed (unique)','CALL FACTS','unique_contacts_dialed','SUM(unique_contacts_dialed) over active filter'],
  ['Overview · KPIs','Total Dials / Calls Attempted','CALL FACTS','calls_attempted','SUM(calls_attempted)  ·  Attempts/Contact = calls_attempted ÷ unique_contacts_dialed'],
  ['Overview · KPIs','Connected — 1st Call %','CALL FACTS','connected_first, unique_contacts_dialed','SUM(connected_first) ÷ SUM(unique_contacts_dialed)'],
  ['Overview · KPIs','Connected — via Retry %','CALL FACTS','connected_r1..r5, unique_contacts_dialed','SUM(r1..r5) ÷ SUM(unique_contacts_dialed)'],
  ['Overview · KPIs','Connect Rate','CALL FACTS','connected_first, r1..r5, unique_contacts_dialed','SUM(1st + r1..r5) ÷ SUM(unique_contacts_dialed)'],
  ['Overview · KPIs','Connect Lift','CALL FACTS','connected_r1..r5, unique_contacts_dialed','SUM(r1..r5) ÷ SUM(unique_contacts_dialed)  (leads rescued by retries)'],
  ['Overview · KPIs','Not Connected / exhausted / scheduled','CALL FACTS','unique_contacts_dialed, connected, retry_exhausted, retry_scheduled','dialed − connected;  of which SUM(retry_exhausted) & SUM(retry_scheduled)'],
  ['Overview · Adoption','Institutes on Retry','CAMPAIGN + COLLEGE MASTER','retry_enabled, college_id, voice_enabled','distinct colleges w/ ≥1 retry campaign ÷ distinct voice_enabled colleges'],
  ['Overview · Adoption','Campaigns on Retry','CAMPAIGN MASTER','retry_enabled','COUNT(retry_enabled=1) ÷ COUNT(all campaigns)'],
  ['Overview · Adoption','Leads Dialed via Retry','CAMPAIGN MASTER','retry_enabled, total_unique_contacts_alltime','SUM(unique where retry on) ÷ SUM(all unique)'],
  ['Overview · Adoption','Retry Mode Split (donut)','CAMPAIGN MASTER','retry_mode','COUNT campaigns by mode among retry_enabled'],
  ['Overview · Adoption','Configured Retry Count (bar)','CAMPAIGN MASTER','configured_retries','COUNT campaigns by configured_retries 1–5'],
  ['Overview · Charts','Connect Rate Progression','CALL FACTS','connected_first, r1..r5, unique_contacts_dialed','cumulative (1st,+r1…+r5) ÷ unique per wave + incremental gain'],
  ['Overview · Charts','Cumulative Connect Rate','CALL FACTS','connected_first, r1..r5, unique_contacts_dialed','same cumulative series as an area'],
  ['Overview · Table','Period Comparison','CALL FACTS','date + all outcome cols','metrics split across date halves of the selected range'],
  ['Overview · Table','No Adoption (RISK)','CAMPAIGN + COLLEGE MASTER','retry_enabled=0, total_unique_contacts_alltime, connected_first_alltime','retry-off bucketed by all-time unique contacts (100k+/25–100k/<25k)'],
  ['Overview · Table','Top 10 Adopters by Connect Rate','CALL FACTS','college_id + outcome cols','per-college connect% desc, top 10'],
  ['Institutions','Client table','CALL FACTS + CAMPAIGN MASTER','college, retry_enabled_campaigns, mode, unique_contacts_dialed, 1st, r1..r5, connect%','per-college roll-up; Retry Campaigns = COUNT retry_enabled ÷ COUNT campaigns'],
  ['Client drill · Header','campaigns · on retry · mode','CAMPAIGN MASTER','campaign_id, retry_enabled, retry_mode','counts + dominant mode for the college'],
  ['Client drill · KPIs','same 5 KPIs, scoped','CALL FACTS','outcome cols filtered to college','as Overview KPIs, filtered by college_id'],
  ['Client drill · Chart','Call-Attempt Distribution (funnel)','CALL FACTS','connected_first, r1..r5, not_connected','stacked share of dialed'],
  ['Client drill · Table','Campaigns (each job)','CALL FACTS + CAMPAIGN MASTER','campaign_id, name, agent, mode, configured, unique_contacts_dialed, calls_attempted, connected, not_conn, connect%, lift%, 1st, r1..r5, retry_exhausted, retry_scheduled','per-campaign roll-up within the college'],
  ['Global filters','College / Agent / Date','COLLEGE / AGENT MASTER / CALL FACTS.date','college_id · agent_id · date','dropdown sources + range bounds'],
]
add('METRIC → SOURCE MAP', ms, w(20,34,26,42,46))

XLSX.writeFile(wb, OUT)
console.log('Saved:', OUT)
console.log('Tabs:', wb.SheetNames.join(' | '))
