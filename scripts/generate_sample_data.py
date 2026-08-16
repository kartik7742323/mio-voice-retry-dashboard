"""
generate_sample_data.py — Produce SYNTHETIC demo data for the
Mio AI Voice Retry adoption dashboard.

⚠️  The output is fabricated. It exists only so the dashboard renders and can be
demoed before real data is available. Replace with scripts/process.py output
(fed by the Mongo dumps described in DATA_SPEC.md) once tech provides the data.

Writes:
  src/data/summary.json            — global adoption + connect-lift aggregates
  src/data/accounts.json           — institution_id -> name map
  public/data/campaigns/{id}.json  — per-institution campaign rows (lazy loaded)

All numbers are deterministic (fixed seed) so re-runs are stable.
"""

import json
import random
from pathlib import Path

SEED = 20260721
random.seed(SEED)

ROOT = Path(__file__).resolve().parent.parent
OUT_SUMMARY = ROOT / "src" / "data" / "summary.json"
OUT_ACCOUNTS = ROOT / "src" / "data" / "accounts.json"
OUT_CAMPAIGNS = ROOT / "public" / "data" / "campaigns"

SERVERS = ["in11", "in12", "in14", "asia1", "us1", "eu1"]
N_INSTITUTIONS = 128
EXTRACTED_DATE = "23jun26-21jul26"   # feature GA window (synthetic)

# Retry waves: fraction of the still-unconnected pool that connects on each retry.
RETRY_WAVE_RATES = [0.17, 0.12, 0.085, 0.06, 0.04]

# ── Institution name generator ────────────────────────────────────────────────
PREFIX = ["Global", "National", "Sunrise", "Heritage", "Crescent", "Summit",
          "Riverside", "Metro", "Pioneer", "Everest", "Lotus", "Nova",
          "Bluebell", "Greenfield", "Ashford", "Kingsley", "Westwood", "Trinity",
          "Vidya", "Amrita", "Sringeri", "Deccan", "Coastal", "Highland"]
CORE = ["Institute of Technology", "College of Management", "University",
        "School of Business", "Academy", "Institute of Design",
        "College of Engineering", "International School", "Polytechnic",
        "College of Arts & Science", "School of Law", "Business School",
        "Institute of Media", "College of Nursing", "School of Architecture"]


def make_name(i):
    return f"{random.choice(PREFIX)} {random.choice(CORE)}"


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def gen_campaign(cid, retry_enabled):
    """Return one campaign row dict."""
    dialed = int(random.choice([
        random.randint(80, 600),
        random.randint(600, 3000),
        random.randint(3000, 20000),
    ]))
    p0 = random.uniform(0.18, 0.42)          # first-attempt connect prob
    first_attempt = int(round(dialed * p0))
    unconn = dialed - first_attempt

    r = [0, 0, 0, 0, 0]
    mode = None
    configured = 0
    next_sched = 0

    if retry_enabled:
        mode = "immediate" if random.random() < 0.6 else "schedule"
        configured = random.choices([1, 2, 3, 4, 5], weights=[12, 40, 24, 14, 10])[0]
        pool = unconn
        for i in range(configured):
            rate = RETRY_WAVE_RATES[i] * random.uniform(0.8, 1.2)
            connects = int(round(pool * rate))
            r[i] = connects
            pool -= connects
        # ~12% of campaigns still in-flight → some retries pending
        if random.random() < 0.12 and pool > 0:
            next_sched = int(round(pool * random.uniform(0.1, 0.4)))

    connected = first_attempt + sum(r)
    not_connected = dialed - connected
    retry_exhausted = clamp(not_connected - next_sched, 0, not_connected)
    connect_pct = round(connected / dialed * 100, 2) if dialed else 0.0
    connect_lift_pct = round((connected - first_attempt) / dialed * 100, 2) if dialed else 0.0

    return {
        "campaign_id": cid,
        "retry_enabled": 1 if retry_enabled else 0,
        "mode": mode,
        "configured_retries": configured,
        "dialed": dialed,
        "connected": connected,
        "not_connected": not_connected,
        "first_attempt": first_attempt,
        "r1": r[0], "r2": r[1], "r3": r[2], "r4": r[3], "r5": r[4],
        "retry_exhausted": retry_exhausted,
        "next_retry_scheduled": next_sched,
        "connect_pct": connect_pct,
        "connect_lift_pct": connect_lift_pct,
    }


RETRY_KEYS = ["r1", "r2", "r3", "r4", "r5"]
SUM_KEYS = ["dialed", "connected", "not_connected", "first_attempt",
            *RETRY_KEYS, "retry_exhausted", "next_retry_scheduled"]


def blank_agg():
    return {k: 0 for k in SUM_KEYS}


def add_into(agg, row):
    for k in SUM_KEYS:
        agg[k] += row[k]


def finalize(agg):
    d = agg["dialed"]
    agg["connect_pct"] = round(agg["connected"] / d * 100, 2) if d else 0.0
    agg["connect_lift_pct"] = round((agg["connected"] - agg["first_attempt"]) / d * 100, 2) if d else 0.0
    return agg


def main():
    accounts = {}
    campaigns_by_inst = {}
    by_institution = []
    by_server_map = {}

    # global connect-lift aggregate (retry-enabled campaigns only)
    global_agg = blank_agg()

    # adoption counters
    voice_campaigns = 0
    retry_campaigns = 0
    mode_immediate = 0
    mode_scheduled = 0
    retry_count_dist = {str(k): 0 for k in range(1, 6)}
    dialed_total = 0
    retry_institutions = 0

    base_id = 5001
    for n in range(N_INSTITUTIONS):
        inst_id = base_id + n
        accounts[str(inst_id)] = make_name(n)
        server = random.choice(SERVERS)

        # ~58% of institutions have adopted retry
        adopter = random.random() < 0.58
        n_campaigns = random.randint(1, 34)

        inst_elig = blank_agg()   # retry-enabled campaigns only
        inst_raw = blank_agg()    # all campaigns
        inst_retry_campaigns = 0
        configured_seen = []
        mode_counts = {"immediate": 0, "schedule": 0}
        rows = []

        for c in range(n_campaigns):
            cid = inst_id * 1000 + c
            # adopters: ~65% of their campaigns use retry; non-adopters: 0
            retry_on = adopter and random.random() < 0.65
            row = gen_campaign(cid, retry_on)
            rows.append(row)

            voice_campaigns += 1
            dialed_total += row["dialed"]
            add_into(inst_raw, row)

            if row["retry_enabled"]:
                retry_campaigns += 1
                inst_retry_campaigns += 1
                mode_counts[row["mode"]] += 1
                configured_seen.append(row["configured_retries"])
                retry_count_dist[str(row["configured_retries"])] += 1
                if row["mode"] == "immediate":
                    mode_immediate += 1
                else:
                    mode_scheduled += 1
                add_into(inst_elig, row)
                add_into(global_agg, row)

        rows.sort(key=lambda x: x["dialed"], reverse=True)
        campaigns_by_inst[inst_id] = rows

        has_retry = inst_retry_campaigns > 0
        if has_retry:
            retry_institutions += 1
        dominant_mode = None
        if has_retry:
            dominant_mode = "immediate" if mode_counts["immediate"] >= mode_counts["schedule"] else "schedule"
        avg_conf = round(sum(configured_seen) / len(configured_seen), 1) if configured_seen else 0

        inst_row = finalize(inst_elig)
        inst_row.update({
            "institution_id": inst_id,
            "server": server,
            "campaigns": n_campaigns,
            "retry_enabled_campaigns": inst_retry_campaigns,
            "retry_enabled": has_retry,
            "dominant_mode": dominant_mode,
            "avg_configured_retries": avg_conf,
            # raw = across ALL campaigns (used by No-Adoption RISK)
            "dialed_raw": inst_raw["dialed"],
            "first_attempt_raw": inst_raw["first_attempt"],
        })
        by_institution.append(inst_row)

        srv = by_server_map.setdefault(server, {
            **blank_agg(), "server": server, "institutions": set(),
            "campaigns": 0, "retry_campaigns": 0,
        })
        srv["institutions"].add(inst_id)
        srv["campaigns"] += n_campaigns
        srv["retry_campaigns"] += inst_retry_campaigns
        add_into(srv, inst_elig)

    finalize(global_agg)

    by_server = []
    for srv in by_server_map.values():
        srv["institutions"] = len(srv["institutions"])
        finalize(srv)
        by_server.append(srv)
    by_server.sort(key=lambda s: s["server"])

    # ── synthetic period splits (proportional slices of the global window) ──────
    def scaled(frac, jitter):
        a = blank_agg()
        for k in SUM_KEYS:
            a[k] = int(global_agg[k] * frac * jitter)
        return finalize(a)

    periods = [
        {"date_range": "23jun26-6jul26", "global": scaled(0.30, 0.94)},
        {"date_range": "7jul26-21jul26", "global": scaled(0.70, 1.03)},
    ]

    adoption = {
        "voice_institutions": N_INSTITUTIONS,
        "retry_institutions": retry_institutions,
        "voice_campaigns": voice_campaigns,
        "retry_campaigns": retry_campaigns,
        "mode_immediate": mode_immediate,
        "mode_scheduled": mode_scheduled,
        "retry_count_dist": retry_count_dist,
        "dialed_retry": global_agg["dialed"],
        "dialed_total": dialed_total,
    }

    summary = {
        "extracted_date": EXTRACTED_DATE,
        "synthetic": True,
        "adoption": adoption,
        "global": global_agg,
        "periods": periods,
        "by_server": by_server,
        "by_institution": by_institution,
    }

    OUT_SUMMARY.parent.mkdir(parents=True, exist_ok=True)
    OUT_SUMMARY.write_text(json.dumps(summary, separators=(",", ":")), encoding="utf-8")
    OUT_ACCOUNTS.write_text(json.dumps(accounts, separators=(",", ":")), encoding="utf-8")

    OUT_CAMPAIGNS.mkdir(parents=True, exist_ok=True)
    for f in OUT_CAMPAIGNS.glob("*.json"):
        f.unlink()
    for inst_id, rows in campaigns_by_inst.items():
        (OUT_CAMPAIGNS / f"{inst_id}.json").write_text(
            json.dumps(rows, separators=(",", ":")), encoding="utf-8")

    print(f"Institutions: {N_INSTITUTIONS}  (retry adopters: {retry_institutions})")
    print(f"Campaigns: {voice_campaigns}  (retry-enabled: {retry_campaigns})")
    print(f"Dialed (retry campaigns): {global_agg['dialed']:,}")
    print(f"Connect rate: {global_agg['connect_pct']}%   Connect lift: +{global_agg['connect_lift_pct']}%")
    print(f"Wrote {OUT_SUMMARY.name}, {OUT_ACCOUNTS.name}, {len(campaigns_by_inst)} campaign files")


if __name__ == "__main__":
    main()
