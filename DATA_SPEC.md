# Mio AI Voice Retry — Dashboard Data Spec

This is the contract between the dashboard and the data pipeline. Hand §3–§4 to
the tech team; they produce the two Mongo exports, `scripts/process.py` turns
them into the JSON the app reads.

Source of truth for field semantics: `MIO_CALLING_RETRY_TECHNICAL_REFERENCE.md`
(§3 Schema, §5.5 retry exhaustion, §5.6 call-attempt timeline).

---

## 1. What the dashboard shows

Two lenses, both requested:

- **Feature Adoption** — who is turning retry on.
  - Institutes on retry / total voice institutes
  - Campaigns on retry / total voice campaigns
  - Leads dialed under retry-enabled campaigns / all leads dialed
  - Retry-mode split (Immediate vs Scheduled)
  - Configured retry-count distribution (1–5)
- **Connect Rate & Retry Lift** — what retry is buying.
  - Connect rate = connected ÷ dialed
  - Connected on 1st call vs connected on retries 1–5
  - **Connect lift** = (connected − connected-on-1st-call) ÷ dialed
  - Retry-exhausted and next-retry-scheduled counts

---

## 2. Core definitions (agree these with tech first)

| Term | Definition | Source |
|------|------------|--------|
| **Dialed** | Distinct leads a campaign attempted at least once | count of voice-log docs per `communication_log_id` |
| **Connected** | Lead answered on any attempt | `answered == 1` OR `status == completed` |
| **first_attempt** | Connected on the initial call (`retry_count == 0`) | connect where the connecting attempt index = 0 |
| **r1 … r5** | Connected on the Nth retry (`retry_count == N`) | connect where connecting attempt index = N |
| **not_connected** | Dialed − connected | derived |
| **retry_exhausted** | Never connected and all configured retries used | §5.5: `configured_retry_count>0 AND retry_count>=configured_retry_count` and not connected |
| **next_retry_scheduled** | Still in-flight, a retry pending | §5.5: not exhausted AND `retry_count != configured_retry_count`; `processed=0` |
| **retry_enabled** | Campaign was launched with retry on | `json_criteria.retry_config.enabled` (post-transform `max_retries>0`) |
| **retry_mode** | `immediate` \| `schedule` | `json_criteria.retry_config` UI shape |
| **configured_retries** | Max retries set (1–5) | `configured_retry_count` / `max_retries` |

**Open questions to close with tech / product:**
1. Connect definition — is `completed` always a human answer, or does it include voicemail/`call-disconnected`? (§5.4 maps `call-disconnected → completed`.)
2. Which attempt gets the connect credited when `retry_history` is absent and we fall back to `infer_history_from_flags()`?
3. Should `next_retry_scheduled` leads count against connect rate now, or be excluded until terminal? (Dashboard currently counts them in `dialed` and `not_connected`.)
4. Nurix-vendor campaigns don't forward `retry_config` (§TD-01). Include them as retry-disabled, or exclude entirely?

---

## 3. Two exports the pipeline needs

Per college DB, collection `communication_detail_voice_broadcasting_log_{college_id}`,
joined to `communication_logs.json_criteria` for the retry config.

### Q1 — per-campaign connect/retry breakdown (date-filtered to the window)

One JSON object per `communication_log_id`:

```json
{
  "communication_log_id": 5001000,
  "retry_enabled": 1,
  "retry_mode": "immediate",
  "configured_retries": 2,
  "connected": 812,
  "first_attempt": 540,
  "r1": 190,
  "r2": 82,
  "r3": 0, "r4": 0, "r5": 0,
  "retry_exhausted": 410,
  "next_retry_scheduled": 25
}
```

### Q2 — all-time total dialed per campaign

```json
[ { "_id": 5001000, "total_count": 1500 }, ... ]
```

`dialed` comes from Q2 (all-time) so connect rate isn't understated when a window
clips mid-campaign — same two-query pattern the WABA dashboard uses.

---

## 4. Suggested Mongo aggregation (Q1)

Connecting-attempt index = `retry_count` of the attempt that produced the connect.
Adapt to the actual `retry_history` shape (§ Appendix A of the tech ref).

```js
db.communication_detail_voice_broadcasting_log_5001.aggregate([
  { $match: { added_on: { $gte: START, $lt: END }, call_type: "outbound" } },
  { $addFields: {
      is_connected: { $or: [ { $eq: ["$answered", 1] }, { $eq: ["$status", "completed"] } ] },
      connect_idx:  "$retry_count"   // 0 = first call, N = Nth retry
  }},
  { $group: {
      _id: "$communication_log_id",
      connected:            { $sum: { $cond: ["$is_connected", 1, 0] } },
      first_attempt:        { $sum: { $cond: [{ $and: ["$is_connected", { $eq: ["$connect_idx", 0] }] }, 1, 0] } },
      r1: { $sum: { $cond: [{ $and: ["$is_connected", { $eq: ["$connect_idx", 1] }] }, 1, 0] } },
      r2: { $sum: { $cond: [{ $and: ["$is_connected", { $eq: ["$connect_idx", 2] }] }, 1, 0] } },
      r3: { $sum: { $cond: [{ $and: ["$is_connected", { $eq: ["$connect_idx", 3] }] }, 1, 0] } },
      r4: { $sum: { $cond: [{ $and: ["$is_connected", { $eq: ["$connect_idx", 4] }] }, 1, 0] } },
      r5: { $sum: { $cond: [{ $and: ["$is_connected", { $eq: ["$connect_idx", 5] }] }, 1, 0] } },
      retry_exhausted: { $sum: { $cond: [ { $and: [
          { $not: "$is_connected" },
          { $gt: ["$configured_retry_count", 0] },
          { $gte: ["$retry_count", "$configured_retry_count"] } ] }, 1, 0 ] } },
      next_retry_scheduled: { $sum: { $cond: [ { $and: [
          { $not: "$is_connected" },
          { $ne: ["$retry_count", "$configured_retry_count"] },
          { $eq: ["$processed", 0] } ] }, 1, 0 ] } }
  }}
  // then $lookup communication_logs for retry_enabled / retry_mode / configured_retries
])
```

`invariant: first_attempt + r1..r5 == connected` (per campaign). `process.py`
recomputes `not_connected`, `connect_pct`, `connect_lift_pct`, so tech does not
send those.

---

## 5. JSON the app consumes (what process.py writes)

`src/data/summary.json`

```jsonc
{
  "extracted_date": "23jun26-21jul26",
  "synthetic": false,                 // flips the amber demo banner off
  "adoption": {
    "voice_institutions": 0, "retry_institutions": 0,
    "voice_campaigns": 0, "retry_campaigns": 0,
    "mode_immediate": 0, "mode_scheduled": 0,
    "retry_count_dist": { "1":0,"2":0,"3":0,"4":0,"5":0 },
    "dialed_retry": 0, "dialed_total": 0
  },
  "global": { "dialed":0,"connected":0,"not_connected":0,"first_attempt":0,
              "r1":0,"r2":0,"r3":0,"r4":0,"r5":0,
              "retry_exhausted":0,"next_retry_scheduled":0,
              "connect_pct":0,"connect_lift_pct":0 },
  "periods": [ { "date_range":"…", "global": { …same as global… } } ],
  "by_server": [ { "server":"in11","institutions":0,"campaigns":0,"retry_campaigns":0, …global fields… } ],
  "by_institution": [ {
     "institution_id":5001,"server":"in11","campaigns":0,"retry_enabled_campaigns":0,
     "retry_enabled":true,"dominant_mode":"immediate","avg_configured_retries":2.0,
     "dialed_raw":0,"first_attempt_raw":0, …global fields…
  } ]
}
```

`public/data/campaigns/{institution_id}.json` — array of campaign rows
(`campaign_id, retry_enabled, mode, configured_retries, dialed, connected,
not_connected, first_attempt, r1..r5, retry_exhausted, next_retry_scheduled,
connect_pct, connect_lift_pct`), loaded lazily on the institution detail page.

`by_institution.*_raw` fields cover ALL campaigns (retry on or off) and power the
**No Adoption (RISK)** table — institutes dialing at scale without retry.

---

## 6. Refresh workflow

```bash
# real data (once tech drops the dumps)
python scripts/process.py --input ./mio-voice-mongo-data
#   or combine two windows:
python scripts/process.py --input ./period1 --input2 ./period2

# demo data (no dumps needed)
npm run sample        # node scripts/generate_sample_data.mjs
```
