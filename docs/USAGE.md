# Usage — Smittvarnings App

This document contains the detailed local usage, simulation helpers and verification/demo flows.

## Overview

- Inputs: place jasen JSONs under `jasen_out/<sub>/` (e.g. `jasen_out/s_aureus/`).
- Conversion: `R/process_json.R` converts one or more jasen JSON files into:
  - `intermediate_files/profiles_for_reportree/<sub>/cgmlst.profile.<sub>_YYYY-MM-DD_<n>`
  - `intermediate_files/profiles_for_reportree/<sub>/metadata.tsv.<sub>_YYYY-MM-DD_<n>`
- Clustering: ReporTree consumes the profile+metadata pair and writes outputs to `intermediate_files/clusters/<sub>/<label>/`.

## Prerequisites

- Docker & Docker Compose (v2 recommended)
- Node.js (watcher and helpers tested on Node 18)
- R (Rscript) — `R/process_json.R` uses rjson/readr/lubridate/tibble/dplyr/tidyr

## Simulation helpers

- `scripts/simulate_jasen_initial.sh`: copy a deterministic initial set of fixtures into `jasen_out/<sub>/`. This script intentionally clears the destination so the initial run is deterministic.
- `scripts/simulate_jasen_additional.sh`: copy additional fixtures into `jasen_out/<sub>/` without removing existing files (for adding extra samples).

Use these to seed `jasen_out/` for reproducible demo runs.

## Watcher vs one-shot runners

- Long-running watchers:

  - `bin/run_reportree_initial_samples.js` — poll and run ReporTree when new profile+metadata pairs appear.
  - `bin/run_reportree_additional_samples.js` — same but for the additional-mode workflow.
  - Use these for continuous production-style operation. Start them under a supervisor (`systemd`, `pm2`, or `nohup`).

- One-shot runners (recommended for CI & demos):
  - `bin/run_reportree_initial_once.js` — process current profiles once and exit.
  - `bin/run_reportree_additional_once.js` — process current profiles once (uses partitions/nomenclature) and exit.

One-shot runners are used by the verify/demo scripts so the commands finish and return status codes.

## Verify & demo scripts

- `scripts/verify_initial.sh`: simulate initial fixtures, convert JSONs with `R/process_json.R` (label `s_aureus_1`), run the one-shot initial runner with a timeout, and check for `_partitions.tsv` in `intermediate_files/clusters/s_aureus/`.
- `scripts/verify_additional.sh`: runs the initial flow to ensure partitions exist, then runs the additional simulation and one-shot additional runner and verifies it used the nomenclature file.
- `scripts/run_demo_initial_then_additional.sh`: convenience script that resets key folders, runs the initial flow, then runs the additional flow and prints a short summary.

Logs are written to `logs/` (see script headers for specific paths).

## Manual conversion example

```bash
Rscript R/process_json.R intermediate_files/profiles_for_reportree s_aureus_1 jasen_out/s_aureus/*.json
```

## Manual ReporTree example (when you want to run the image directly)

Run ReporTree so files are written as your host user:

```bash
docker run --rm -v $(pwd)/intermediate_files:/data -w /data --user $(id -u):$(id -g) \
  insapathogenomics/reportree reportree.py -m /data/profiles_for_reportree/s_aureus/<metadata> \
  -a /data/profiles_for_reportree/s_aureus/<profile> -out /data/clusters/s_aureus/<label> \
  --analysis grapetree --method MSTreeV2 -thr 10
```

## NPM shortcuts

Some npm scripts are provided in `package.json` to make common tasks easier:

- `npm run run-reportree:initial:once`
- `npm run run-reportree:additional:once`
- `npm run verify:initial`
- `npm run verify:additional`
- `npm run demo:run`

## Troubleshooting

- If outputs are owned by `root` after a Docker run:

```bash
sudo chown -R $(id -u):$(id -g) intermediate_files jasen_out logs
```

- If the watcher complains about missing R packages, rebuild the watcher image so its Dockerfile installs the required packages.

## Next improvements (optional)

- Add small unit tests for the JSON → profile conversion (R / testthat) and CI that runs `scripts/verify_additional.sh` (timeout tuned for CI).
- Provide a `docs/` landing page linked from the top-level README (done).
