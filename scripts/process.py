"""
process.py — Parse Mio AI Voice retry MongoDB query dumps into dashboard JSON.

This is the REAL-DATA pipeline. It replaces generate_sample_data.py once tech
provides the two query exports described in DATA_SPEC.md.

Input layout (mirrors the WABA retry dashboard convention):

  <input-dir>/
    q1-connect-breakdown/   *.txt   # per-campaign retry/connect breakdown (date-filtered)
    q2-total-dialed/        *.txt   # all-time total dialed per campaign
    date.txt                        # e.g. "23jun26-21jul26"

Each .txt is the mongosh output for one server, delimited by lines like:
  Collection: communication_detail_voice_broadcasting_log_5001
followed by the aggregation result objects (one JSON object per campaign for Q1,
a JSON array for Q2). See DATA_SPEC.md §4 for the exact aggregation pipeline.

Usage:
  python scripts/process.py --input ./mio-voice-mongo-data
  python scripts/process.py --input ./period1 --input2 ./period2   # combine windows

Outputs:
  src/data/summary.json
  public/data/campaigns/{institution_id}.json
"""

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

COLLECTION_RE = re.compile(r'communication_detail_voice_broadcasting_log_(\d+)')
NUMBER_LONG_RE = re.compile(r'NumberLong\((\d+)\)')
SERVER_RE = re.compile(r'npfmongod_voice(?:_(.+))?_output\.txt')

RETRY_KEYS = ['r1', 'r2', 'r3', 'r4', 'r5']
SUM_KEYS = ['dialed', 'connected', 'not_connected', 'first_attempt',
            *RETRY_KEYS, 'retry_exhausted', 'next_retry_scheduled']


# ─── Helpers ──────────────────────────────────────────────────────────────────

def extract_server(filename: str) -> str:
    m = SERVER_RE.match(filename)
    if m:
        return m.group(1) if m.group(1) else 'main'
    return filename.replace('_output.txt', '')


def extract_institution_id(collection_name: str):
    m = COLLECTION_RE.search(collection_name)
    return int(m.group(1)) if m else None


def normalize_number_long(text: str) -> str:
    return NUMBER_LONG_RE.sub(r'\1', text)


# ─── Q1 parser: per-campaign connect/retry breakdown ────────────────────────────

def parse_q1_file(filepath: Path, server: str) -> list:
    records = []
    inst_id = None
    in_object = False
    obj_lines = []

    with open(filepath, encoding='utf-8', errors='replace') as f:
        for line in f:
            stripped = line.strip()
            if stripped.startswith('Collection:'):
                inst_id = extract_institution_id(stripped.split('Collection:', 1)[1].strip())
                continue
            if (stripped.startswith(('Executing query', 'Query executed', '[SKIP]', '=', '-'))
                    or stripped == ''):
                continue
            if stripped == '{':
                in_object, obj_lines = True, ['{']
                continue
            if stripped in ('}', '},') and in_object:
                obj_lines.append('}')
                in_object = False
                try:
                    o = json.loads(normalize_number_long('\n'.join(obj_lines)))
                    if inst_id is not None:
                        records.append({
                            'institution_id': inst_id,
                            'server': server,
                            'campaign_id': int(o['communication_log_id']),
                            'retry_enabled': int(o.get('retry_enabled', 0)),
                            'mode': o.get('retry_mode'),
                            'configured_retries': int(o.get('configured_retries', 0)),
                            'connected': int(o.get('connected', 0)),
                            'first_attempt': int(o.get('first_attempt', 0)),
                            'r1': int(o.get('r1', 0)),
                            'r2': int(o.get('r2', 0)),
                            'r3': int(o.get('r3', 0)),
                            'r4': int(o.get('r4', 0)),
                            'r5': int(o.get('r5', 0)),
                            'retry_exhausted': int(o.get('retry_exhausted', 0)),
                            'next_retry_scheduled': int(o.get('next_retry_scheduled', 0)),
                        })
                except (json.JSONDecodeError, KeyError, ValueError):
                    pass
                obj_lines = []
                continue
            if in_object:
                obj_lines.append(stripped)
    return records


# ─── Q2 parser: total dialed per campaign ───────────────────────────────────────

def parse_q2_file(filepath: Path, server: str) -> list:
    records = []
    inst_id = None
    in_array = False
    array_lines = []

    def flush(lines, iid):
        try:
            arr = json.loads(normalize_number_long('\n'.join(lines)))
        except json.JSONDecodeError:
            return
        for item in arr:
            try:
                records.append({
                    'institution_id': iid,
                    'server': server,
                    'campaign_id': int(item['_id']),
                    'dialed': int(item['total_count']),
                })
            except (KeyError, ValueError, TypeError):
                pass

    with open(filepath, encoding='utf-8', errors='replace') as f:
        for line in f:
            stripped = line.strip()
            if stripped.startswith('Collection:'):
                if in_array and array_lines and inst_id is not None:
                    flush(array_lines, inst_id)
                    array_lines, in_array = [], False
                inst_id = extract_institution_id(stripped.split('Collection:', 1)[1].strip())
                continue
            if inst_id is None or stripped.startswith(('Executing query', 'Query executed', '-')) or stripped == '':
                continue
            if stripped.startswith('[') and stripped.endswith(']'):
                norm = normalize_number_long(stripped)
                if norm.strip() in ('[]', '[ ]'):
                    continue
                try:
                    for item in json.loads(norm):
                        records.append({
                            'institution_id': inst_id, 'server': server,
                            'campaign_id': int(item['_id']), 'dialed': int(item['total_count']),
                        })
                except (json.JSONDecodeError, KeyError, ValueError):
                    pass
                continue
            if stripped == '[':
                in_array, array_lines = True, ['[']
                continue
            if stripped == ']' and in_array:
                array_lines.append(']')
                flush(array_lines, inst_id)
                array_lines, in_array = [], False
                continue
            if in_array:
                array_lines.append(stripped)

    if in_array and array_lines and inst_id is not None:
        flush(array_lines, inst_id)
    return records


# ─── Folder / date detection ────────────────────────────────────────────────────

def find_query_folders(input_dir: Path):
    candidates = [c for c in input_dir.iterdir() if c.is_dir()]
    q1 = q2 = None
    for c in candidates:
        name = c.name.lower()
        if 'q2' in name or 'total' in name or 'query2' in name:
            q2 = c
        elif 'q1' in name or 'connect' in name or 'breakdown' in name or 'query1' in name:
            q1 = c
    if q2 and not q1:
        others = [c for c in candidates if c != q2]
        if len(others) == 1:
            q1 = others[0]
    if not q1 or not q2:
        raise FileNotFoundError(
            f"Could not auto-detect Q1/Q2 folders in {input_dir}. Found: {[c.name for c in candidates]}")
    return q1, q2


def read_date(input_dir: Path) -> str:
    df = input_dir / 'date.txt'
    if df.exists():
        return df.read_text(encoding='utf-8').strip()
    m = re.search(r'(\d+\w+\d+-\d+\w+\d+)$', input_dir.name)
    return m.group(1) if m else input_dir.name


def combine_dates(d1, d2):
    return f"{d1.split('-')[0]}-{d2.split('-')[-1]}"


# ─── Aggregation ─────────────────────────────────────────────────────────────────

def blank():
    return {k: 0 for k in SUM_KEYS}


def add_into(agg, row):
    for k in SUM_KEYS:
        agg[k] += row.get(k, 0)


def finalize(agg):
    d = agg['dialed']
    agg['connect_pct'] = round(agg['connected'] / d * 100, 2) if d else 0.0
    agg['connect_lift_pct'] = round((agg['connected'] - agg['first_attempt']) / d * 100, 2) if d else 0.0
    return agg


def join(q1_map, q2_map):
    """Join Q1 breakdown with Q2 total-dialed; return campaign rows keyed by (inst, campaign)."""
    rows = []
    for key, q2 in q2_map.items():
        dialed = q2['dialed']
        if dialed <= 1:
            continue
        q1 = q1_map.get(key)
        if q1 is None:
            # dialed but no retry breakdown → treat as retry-disabled, all first-attempt unknown
            rows.append({
                'institution_id': key[0], 'server': q2['server'], 'campaign_id': key[1],
                'retry_enabled': 0, 'mode': None, 'configured_retries': 0,
                'dialed': dialed, 'connected': 0, 'first_attempt': 0,
                **{k: 0 for k in RETRY_KEYS},
                'retry_exhausted': dialed, 'next_retry_scheduled': 0,
                'not_connected': dialed, 'connect_pct': 0.0, 'connect_lift_pct': 0.0,
            })
            continue
        connected = q1['connected']
        row = {**q1, 'dialed': dialed, 'not_connected': dialed - connected}
        row['connect_pct'] = round(connected / dialed * 100, 2) if dialed else 0.0
        row['connect_lift_pct'] = round((connected - q1['first_attempt']) / dialed * 100, 2) if dialed else 0.0
        rows.append(row)
    return rows


def build_summary(campaign_rows, extracted_date, periods=None):
    by_inst = defaultdict(list)
    for r in campaign_rows:
        by_inst[r['institution_id']].append(r)

    global_agg = blank()
    by_institution, by_server_map = [], {}
    adoption = {
        'voice_institutions': 0, 'retry_institutions': 0,
        'voice_campaigns': 0, 'retry_campaigns': 0,
        'mode_immediate': 0, 'mode_scheduled': 0,
        'retry_count_dist': {str(k): 0 for k in range(1, 6)},
        'dialed_retry': 0, 'dialed_total': 0,
    }

    for inst_id, rows in by_inst.items():
        adoption['voice_institutions'] += 1
        elig, raw = blank(), blank()
        retry_campaigns = 0
        modes = {'immediate': 0, 'schedule': 0}
        configured_seen = []
        server = rows[0]['server']

        for r in rows:
            adoption['voice_campaigns'] += 1
            adoption['dialed_total'] += r['dialed']
            raw['dialed'] += r['dialed']
            raw['first_attempt'] += r['first_attempt']
            if r['retry_enabled']:
                retry_campaigns += 1
                adoption['retry_campaigns'] += 1
                adoption['dialed_retry'] += r['dialed']
                if r['mode'] in modes:
                    modes[r['mode']] += 1
                    adoption['mode_immediate' if r['mode'] == 'immediate' else 'mode_scheduled'] += 1
                cr = r['configured_retries']
                if 1 <= cr <= 5:
                    adoption['retry_count_dist'][str(cr)] += 1
                    configured_seen.append(cr)
                add_into(elig, r)
                add_into(global_agg, r)

        has_retry = retry_campaigns > 0
        if has_retry:
            adoption['retry_institutions'] += 1
        finalize(elig)
        by_institution.append({
            **elig,
            'institution_id': inst_id, 'server': server,
            'campaigns': len(rows), 'retry_enabled_campaigns': retry_campaigns,
            'retry_enabled': has_retry,
            'dominant_mode': (None if not has_retry else
                              ('immediate' if modes['immediate'] >= modes['schedule'] else 'schedule')),
            'avg_configured_retries': round(sum(configured_seen) / len(configured_seen), 1) if configured_seen else 0,
            'dialed_raw': raw['dialed'], 'first_attempt_raw': raw['first_attempt'],
        })

        srv = by_server_map.setdefault(server, {**blank(), 'server': server,
                                                'institutions': set(), 'campaigns': 0, 'retry_campaigns': 0})
        srv['institutions'].add(inst_id)
        srv['campaigns'] += len(rows)
        srv['retry_campaigns'] += retry_campaigns
        add_into(srv, elig)

    finalize(global_agg)
    by_server = []
    for srv in by_server_map.values():
        srv['institutions'] = len(srv['institutions'])
        by_server.append(finalize(srv))
    by_server.sort(key=lambda s: s['server'])

    return {
        'extracted_date': extracted_date,
        'synthetic': False,
        'adoption': adoption,
        'global': global_agg,
        'periods': periods or [],
        'by_server': by_server,
        'by_institution': by_institution,
    }, by_inst


def parse_folder(input_dir: Path):
    q1_dir, q2_dir = find_query_folders(input_dir)
    q1, q2 = [], []
    for f in sorted(q1_dir.glob('*.txt')):
        q1.extend(parse_q1_file(f, extract_server(f.name)))
    for f in sorted(q2_dir.glob('*.txt')):
        q2.extend(parse_q2_file(f, extract_server(f.name)))
    q1_map = {(r['institution_id'], r['campaign_id']): r for r in q1}
    q2_map = {}
    for r in q2:
        k = (r['institution_id'], r['campaign_id'])
        if k not in q2_map or r['dialed'] > q2_map[k]['dialed']:
            q2_map[k] = r
    return q1_map, q2_map


def main():
    ap = argparse.ArgumentParser(description='Process Mio AI Voice retry Mongo dumps into dashboard JSON.')
    ap.add_argument('--input', required=True)
    ap.add_argument('--input2', default='')
    ap.add_argument('--out-summary', default='src/data/summary.json')
    ap.add_argument('--out-campaigns', default='public/data/campaigns')
    args = ap.parse_args()

    d1 = Path(args.input)
    if not d1.is_dir():
        print(f'ERROR: --input {d1} not a directory', file=sys.stderr); sys.exit(1)

    q1_map, q2_map = parse_folder(d1)
    date = read_date(d1)
    periods = [{'date_range': date, 'global': None}]

    if args.input2:
        d2 = Path(args.input2)
        q1b, q2b = parse_folder(d2)
        # period globals before merge
        p1_rows = join(q1_map, q2_map)
        p2_rows = join(q1b, q2b)
        periods = [
            {'date_range': date, 'global': finalize_period(p1_rows)},
            {'date_range': read_date(d2), 'global': finalize_period(p2_rows)},
        ]
        q1_map.update(q1b)
        for k, v in q2b.items():
            if k not in q2_map or v['dialed'] > q2_map[k]['dialed']:
                q2_map[k] = v
        date = combine_dates(date, read_date(d2))

    campaign_rows = join(q1_map, q2_map)
    if len(periods) == 1:
        periods[0]['global'] = finalize_period(campaign_rows)

    summary, by_inst = build_summary(campaign_rows, date, periods)

    out_summary = Path(args.out_summary)
    out_summary.parent.mkdir(parents=True, exist_ok=True)
    out_summary.write_text(json.dumps(summary, separators=(',', ':')), encoding='utf-8')

    out_dir = Path(args.out_campaigns)
    out_dir.mkdir(parents=True, exist_ok=True)
    active = {str(i) for i in by_inst}
    for f in out_dir.glob('*.json'):
        if f.stem not in active:
            f.unlink()
    for inst_id, rows in by_inst.items():
        rows.sort(key=lambda c: c['dialed'], reverse=True)
        (out_dir / f'{inst_id}.json').write_text(json.dumps(rows, separators=(',', ':')), encoding='utf-8')

    g = summary['global']
    print(f"Institutions: {summary['adoption']['voice_institutions']} "
          f"(adopters: {summary['adoption']['retry_institutions']})")
    print(f"Connect rate: {g['connect_pct']}%  Connect lift: +{g['connect_lift_pct']}%")
    print(f"Wrote {out_summary} and {len(by_inst)} campaign files")


def finalize_period(rows):
    agg = blank()
    for r in rows:
        if r['retry_enabled']:
            add_into(agg, r)
    return finalize(agg)


if __name__ == '__main__':
    main()
