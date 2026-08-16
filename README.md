# Mio AI Voice — Retry Adoption & Connect-Rate Dashboard

Internal analytics dashboard tracking adoption and impact of the **Retry** feature
in Mio AI Voice (Bolna) outbound calling. Modeled on the WABA Retry dashboard,
re-framed for calling: *dialed → connected*, with a first-class **Feature Adoption**
section alongside **Connect-Rate Lift**.

> ⚠️ Currently loaded with **synthetic demo data** so it renders before real data
> exists. See [`DATA_SPEC.md`](./DATA_SPEC.md) for the metrics/fields to request
> from tech, then run `process.py` to swap in real numbers.

## Stack
React 18 · Vite · Tailwind · Recharts · TanStack Table · xlsx (Excel export).

## Run
```bash
npm install
npm run sample     # (re)generate synthetic demo data  [Node, no Python needed]
npm run dev        # http://localhost:5173
```
Login (dev default): `admin@meritto.com` / `mioVoice2026`
(override via `VITE_AUTH_EMAIL` / `VITE_AUTH_PASSWORD`).

## Pages
- **Overview** — adoption tiles (institutes / campaigns / dials on retry), retry-mode
  split, configured-retry-count distribution, connect-rate KPIs, connect-lift
  progression charts, period comparison, No-Adoption (RISK) table, top adopters.
- **Institutions** — sortable/searchable table; toggle adopters vs all; click through.
- **Institution detail** — per-campaign breakdown, call-attempt funnel, KPIs.

## Data
| File | Produced by | Purpose |
|------|-------------|---------|
| `src/data/summary.json` | process.py / generate_sample_data | global + adoption + per-institution aggregates |
| `src/data/accounts.json` | same | institution_id → name |
| `public/data/campaigns/{id}.json` | same | per-institution campaign rows (lazy) |

Real pipeline: `python scripts/process.py --input ./mio-voice-mongo-data`
(see `DATA_SPEC.md`). Synthetic: `node scripts/generate_sample_data.mjs`.

The amber "synthetic demo data" banner disappears automatically once
`summary.json` has `"synthetic": false` (process.py sets this).
