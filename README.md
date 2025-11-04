# Smittvarnings App — local pipeline

Small local pipeline for converting jasen JSON outputs into cgMLST profiles and running ReporTree clustering.

Key ideas

- Input JSONs: `jasen_out/<subfolder>/*.json` (e.g. `jasen_out/s_aureus/`)
- R conversion: `process_json.R` reads JSON(s) and writes
  - `intermediate_files/profiles_for_reportree/<sub>/cgmlst.profile.<label>_YYYY-MM-DD_YYYY-MM-DD`
  - `intermediate_files/profiles_for_reportree/<sub>/metadata.tsv.<label>_...`
- Clustering: `run_reportree.js` detects the profile+metadata pairs and runs ReporTree (Docker) to produce
  - `intermediate_files/clusters/<sub>/<label>/...` (clusterComposition, partitions, logs, etc.)

Prerequisites

- Node.js (v14+)
- Rscript with required packages (rjson, tidyverse, readr, lubridate)
- Docker (for running ReporTree image)

Quick start (local testing)

# Smittvarnings App — local pipeline

Small, local pipeline for converting jasen JSON outputs into cgMLST profiles and running ReporTree clustering.

## Overview

- Inputs: `jasen_out/<subfolder>/*.json` (for example `jasen_out/s_aureus/`).
- Conversion: `process_json.R` converts JSON(s) into a cgMLST profile and (fake) metadata.
- Clustering: `reportree` (container) consumes a profile + metadata pair and writes cluster outputs under `intermediate_files/clusters/<sub>/<label>/`.

## What this repo does

- `jasen_out_watcher.js` — Node watcher that scans `jasen_out` subfolders for new JSON files and runs `process_json.R` to produce profiles and metadata.
- `process_json.R` — Rscript that prefers cgMLST allele blocks, normalizes missing allele calls to "0", and writes deterministic allele columns into `intermediate_files/profiles_for_reportree/<sub>/`.
- `reportree-service` / `scripts/reportree_watcher.sh` — runs ReporTree inside the official `insapathogenomics/reportree` image and writes cluster outputs into `intermediate_files/clusters/` (no host Docker socket required).
- `reset_workspace.sh` and `simulate_jasen_output.sh` — helpers to create a clean, deterministic test run using the fixtures in `backup_jasen_out/`.

## Prerequisites

- Linux / WSL or macOS with Docker.
- Docker & Docker Compose (compose v2 recommended).
- Node.js (the watcher and helper scripts are tested with Node 18).
- R (Rscript). The watcher image contains the R runtime and installs these R packages used by `process_json.R`:
  - `rjson`, `readr`, `lubridate`, `tibble`, `dplyr`, `tidyr`, `purrr`.

## Quick start (compose-based, recommended)

1. Reset the workspace and copy deterministic test fixtures:

```bash
sh reset_workspace.sh --wipe
sh simulate_jasen_output.sh
```

2. Build and start the watcher + reportree service:

```bash
docker compose up -d --build watcher reportree-service
```

3. Follow logs to watch conversion and clustering:

```bash
docker compose logs -f watcher reportree-service --no-color
```

## Try it — check outputs

```bash
# List generated profiles
ls intermediate_files/profiles_for_reportree/s_aureus/

# Inspect cluster composition for the latest label (replace <label> with the actual file prefix)
head -n 40 intermediate_files/clusters/s_aureus/<label>_clusterComposition.tsv
```

# Smittvarnings App — local pipeline

Small, local pipeline for converting jasen JSON outputs into cgMLST profiles and running ReporTree clustering.

## Overview

- Inputs: `jasen_out/<subfolder>/*.json` (for example `jasen_out/s_aureus/`).
- Conversion: `process_json.R` converts JSON(s) into a cgMLST profile and (fake) metadata.
- Clustering: `reportree` (container) consumes a profile + metadata pair and writes cluster outputs under `intermediate_files/clusters/<sub>/<label>/`.

## What this repo does

- `jasen_out_watcher.js` — Node watcher that scans `jasen_out` subfolders for new JSON files and runs `process_json.R` to produce profiles and metadata.
- `process_json.R` — Rscript that prefers cgMLST allele blocks, normalizes missing allele calls to "0", and writes deterministic allele columns into `intermediate_files/profiles_for_reportree/<sub>/`.
- `reportree-service` / `scripts/reportree_watcher.sh` — runs ReporTree inside the official `insapathogenomics/reportree` image and writes cluster outputs into `intermediate_files/clusters/` (no host Docker socket required).
- `reset_workspace.sh` and `simulate_jasen_output.sh` — helpers to create a clean, deterministic test run using the fixtures in `backup_jasen_out/`.

## Prerequisites

- Linux / WSL or macOS with Docker.
- Docker & Docker Compose (compose v2 recommended).
- Node.js (the watcher and helper scripts are tested with Node 18).
- R (Rscript). The watcher image contains the R runtime and installs these R packages used by `process_json.R`:
  - `rjson`, `readr`, `lubridate`, `tibble`, `dplyr`, `tidyr`, `purrr`.

## Quick start (compose-based, recommended)

1. Reset the workspace and copy deterministic test fixtures:

```bash
sh scripts/reset_workspace.sh --wipe
sh scripts/simulate_jasen_output.sh
```

2. Build and start the watcher + reportree service:

```bash
docker compose up -d --build watcher reportree-service
```

3. Follow logs to watch conversion and clustering:

```bash
docker compose logs -f watcher reportree-service --no-color
```

## Try it — check outputs

```bash
# List generated profiles
ls intermediate_files/profiles_for_reportree/s_aureus/

# Inspect cluster composition for the latest label (replace <label> with the actual file prefix)
head -n 40 intermediate_files/clusters/s_aureus/<label>_clusterComposition.tsv
```

## Manual / single-shot commands

Convert JSONs to profiles directly (single run):

```bash
Rscript process_json.R intermediate_files/profiles_for_reportree <label> jasen_out/s_aureus/*.json
```

Run ReporTree manually (example using the official image; ensure the container writes files as the host user):

```bash
docker run --rm -v $(pwd)/intermediate_files:/data -w /data --user $(id -u):$(id -g) \
  insapathogenomics/reportree reportree.py -m /data/profiles_for_reportree/s_aureus/<metadata> \
  -a /data/profiles_for_reportree/s_aureus/<profile> -out /data/clusters/s_aureus/<label> \
  --analysis grapetree --method MSTreeV2 -thr 10
```

## Important notes

- Canonical fixtures: treat `backup_jasen_out/` as read-only test fixtures. Use `scripts/simulate_jasen_output.sh` to copy them into `jasen_out/` when testing.
- Determinism: the watcher sorts subfolders and filenames before invoking `process_json.R` so file ordering is stable.
- Timezones: the watcher sets `TZ=UTC` for spawned R processes if unset to avoid local inconsistencies.
- Permissions: `reportree` writes files under `intermediate_files/clusters/`. The compose `reportree-service` approach avoids mounting the host Docker socket and therefore avoids creating root-owned host files in normal operation.

## Troubleshooting

- Missing R packages inside the watcher image: rebuild the watcher image (`docker compose up -d --build watcher`) so the Dockerfile installs the required R packages.
- Permission problems (root-owned files): either run ReporTree with `--user $(id -u):$(id -g)` when executing `docker run` on the host, or use the provided `reportree-service` in Compose which runs ReporTree inside its own container and mounts `./intermediate_files:/data`.
- If you see no clusters produced: check the watcher logs and ensure `process_json.R` wrote both the `cgmlst.profile.*` and the corresponding `metadata.tsv.*` in `intermediate_files/profiles_for_reportree/<sub>/`.

## Housekeeping

- Remove orphan containers created during iterative testing:

```bash
docker compose down --remove-orphans
```

- If you need to fix ownership of files under `intermediate_files` (e.g., created by a previous root-owned run):

```bash
sudo chown -R $(id -u):$(id -g) intermediate_files jasen_out
```

## CI / integration

- A basic integration workflow lives at `.github/workflows/integration.yml`. It resets the workspace, builds the images, copies fixtures, and verifies cluster outputs. You may need to tune timeouts on GitHub Actions runners because building images and running containers can take several minutes.

## Next steps / suggestions

- Add small unit tests for the JSON → profile parsing and a CI job that asserts that watcher runs produce the same profile as a manual `Rscript` invocation.
- Consider a lightweight process supervisor (systemd unit or `pm2`) to keep the watcher running on a host.

## Contributing

If you want me to also add a short integration test or wire `pm2`/systemd unit files and update the CI accordingly, tell me which you prefer and I'll implement it.
