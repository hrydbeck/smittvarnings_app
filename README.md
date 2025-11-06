### Smittvarnings App — local pipeline

Small local pipeline for converting jasen JSON outputs into cgMLST profiles and running ReporTree clustering.

## Overview

- Inputs: jasen JSON files placed under `jasen_out/<subfolder>/` (example: `jasen_out/s_aureus/`).
- Conversion: `R/process_json.R` parses jasen JSON(s) and writes two files under `intermediate_files/profiles_for_reportree/<sub>/`:
  - `cgmlst.profile.<sub>_YYYY-MM-DD_<n>` — tab-separated profile table
  - `metadata.tsv.<sub>_YYYY-MM-DD_<n>` — metadata used by ReporTree
- Clustering: ReporTree consumes the profile+metadata pair and writes outputs under `intermediate_files/clusters/<sub>/<label>/` (partitions, cluster composition, trees, logs, etc.).

## Prerequisites

- Linux / WSL or macOS with Docker.
- Docker & Docker Compose (compose v2 recommended).
- Node.js (watcher and helpers tested on Node 18).
- R (Rscript). The watcher image installs the R packages used by `R/process_json.R` (rjson, readr, lubridate, tibble, dplyr, tidyr).

## Quick start

1. Reset the workspace (optional) and copy deterministic test fixtures (examples provided in `backup_jasen_out/`):

```bash
sh scripts/reset_workspace.sh --wipe
sh scripts/simulate_jasen_initial.sh   # initial test fixtures
sh scripts/simulate_jasen_additional.sh # additional fixtures (optional)
```

## Simulation helpers

- `scripts/simulate_jasen_initial.sh` — copies a deterministic initial set of fixtures into `jasen_out/s_aureus/`. This script resets the destination first so the test is deterministic.
- `scripts/simulate_jasen_additional.sh` — copies additional fixtures into `jasen_out/s_aureus/` (does not clear existing files).

## Watcher vs one-shot runners

- Watchers (long-running):
  - `bin/run_reportree_initial_samples.js` and `bin/run_reportree_additional_samples.js` poll the profiles folder and run ReporTree when new profile+metadata pairs appear. These are intended for continuous operation and won't exit on their own.

- One-shot runners (exit after processing):
  - `bin/run_reportree_initial_once.js` and `bin/run_reportree_additional_once.js` process all currently available profile+metadata pairs once and then exit. Use these in CI, demos, or when you want a run to finish and return a status.

## Verification & demo scripts

- `scripts/verify_initial.sh` — simulate initial fixtures, run `R/process_json.R` (label `s_aureus_1`), run the one-shot initial runner (timeout), and verify that `_partitions.tsv` appears under `intermediate_files/clusters/s_aureus/`. Log: `logs/verify_initial.log`.

- `scripts/verify_additional.sh` — run the initial flow to create partitions, simulate additional fixtures, run conversion (label `s_aureus_2`), run the one-shot additional runner, and verify that the runner used the existing nomenclature/partitions file. Logs: `logs/verify_additional_init.log` and `logs/verify_additional.log`.

- `scripts/run_demo_initial_then_additional.sh` — convenience demo that resets `jasen_out` and intermediate folders, runs the initial flow, then runs the additional flow, and prints a short summary. Logs: `logs/run_demo_initial.log`, `logs/run_demo_additional.log`.

## Usage examples

```bash
# Run an initial verification (convert JSONs and run ReporTree once)
chmod +x scripts/verify_initial.sh
./scripts/verify_initial.sh

# Run the additional verification (initial -> additional)
chmod +x scripts/verify_additional.sh
./scripts/verify_additional.sh

# Run the combined demo (resets folders then run initial + additional)
chmod +x scripts/run_demo_initial_then_additional.sh
./scripts/run_demo_initial_then_additional.sh
```

## NPM script shortcuts

You can also invoke runners and verification scripts via npm (shortcuts defined in `package.json`):

| Command | Action |
|---|---|
| `npm run start` | Start the long-running watcher (`bin/jasen_out_watcher.js`). |
| `npm run run-reportree:initial` | Start the initial ReporTree watcher (long-running). |
| `npm run run-reportree:additional` | Start the additional ReporTree watcher (long-running). |
| `npm run run-reportree:initial:once` | One-shot initial runner: process current profiles once and exit. |
| `npm run run-reportree:additional:once` | One-shot additional runner: process current profiles once and exit (requires partitions). |
| `npm run verify:initial` | Run `scripts/verify_initial.sh`. |
| `npm run verify:additional` | Run `scripts/verify_additional.sh`. |
| `npm run demo:run` | Run `scripts/run_demo_initial_then_additional.sh`. |

## Notes & troubleshooting

- Logs from demo/verify scripts are in `logs/`. If a run times out (default timeouts are 300s) the script prints the log tail for debugging.
- If you want continuous processing, start the watcher scripts with a supervisor (e.g., `nohup`, `systemd`, or `pm2`). Use one-shot runners for CI or demos.
- If ReporTree runs create files owned by `root`, run:

```bash
sudo chown -R $(id -u):$(id -g) intermediate_files jasen_out logs
```

- If R packages are missing inside the watcher image, rebuild it so the Dockerfile installs required R packages.

## Email alerts

The evaluator can send email alerts when SMTP settings are provided via environment variables or a `.env` file. Example `.env` entries:

```ini
SMTP_HOST=smtp.example.org
SMTP_PORT=587
SMTP_USER=optional_user
SMTP_PASS=optional_pass
SMTP_FROM=smittvarnings@example.org
ALERT_EMAIL=you@example.org
```

Quick test (send a test email):

```bash
node scripts/send_test_email.js
# or with dotenv loader
node -r dotenv/config scripts/send_test_email.js
```

## Housekeeping

- Remove orphan containers:

```bash
docker compose down --remove-orphans
```

- Create a local `.env` from the example (do not commit it):

```bash
cp .env.example .env
chmod 600 .env
```

## CI / integration

- A basic integration workflow is present at `.github/workflows/integration.yml`. It resets the workspace, builds images, copies fixtures, and verifies outputs. You may need to tune timeouts on CI runners.

## Contributing

If you want me to add unit tests for the JSON → profile parsing, wire a supervisor (`pm2`/systemd), or add a CI integration job, tell me which you'd prefer and I can implement it.
