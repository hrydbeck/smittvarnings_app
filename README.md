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

1. Reset workspace (safe):

```bash
sh reset_workspace.sh
```

2. Populate test input (copies from backup):

```bash
sh simulate_jasen_output.sh
# this copies files from backup_jasen_out/ into jasen_out/
```

3. Run watchers (or run manually):

Start reportree watcher (picks up profile files and runs Docker):

```bash
node run_reportree.js > run_reportree.log 2>&1 &
```

Start jasen watcher (detects new JSONs and runs `process_json.R`):

```bash
node jasen_out_watcher.js > jasen_out_watcher.log 2>&1 &
```

Manual (single-shot) commands

- Convert JSONs to profiles directly:

```bash
Rscript process_json.R intermediate_files/profiles_for_reportree <label> jasen_out/s_aureus/*.json
```

- Run ReporTree manually (example uses Docker image mounted at `intermediate_files`):

```bash
# from repo root
docker run --rm -v $(pwd)/intermediate_files:/data -w /data --user $(id -u):$(id -g) \
  insapathogenomics/reportree reportree.py -m /data/profiles_for_reportree/s_aureus/<metadata> \
  -a /data/profiles_for_reportree/s_aureus/<profile> -out /data/clusters/s_aureus/<label> --analysis grapetree --method MSTreeV2 -thr 10
```

Important notes

- The canonical test files live in `backup_jasen_out/s_aureus/`. Use `simulate_jasen_output.sh` to copy them into `jasen_out/` when you want to run tests. Do not modify the `backup_jasen_out/` files — treat them as source-of-truth test fixtures.
- If `process_json.R` produces a small `gene1,gene2,gene3` profile it means the input JSONs are simplified test files containing those loci. Real cgMLST (SACOL####) data will produce many more allele columns.
- The watcher sorts subfolders and filenames before invoking R so file ordering is deterministic and matches shell glob ordering.
- `run_reportree.js` ensures Docker writes files as the host user by passing `--user $(id -u):$(id -g)` and uses `-w /data` to avoid GrapeTree permission issues. Cluster outputs mirror the profile subfolder name (e.g. `s_aureus`).
- Timezones: watcher sets `TZ` to `UTC` for spawned R processes if unset to avoid systems without systemd calling `timedatectl`.

Troubleshooting

- Check logs:
  - `tail -f jasen_out_watcher.log run_reportree.log`
- Compare profiles:
  - `sha256sum intermediate_files/profiles_for_reportree/s_aureus/*.profile*`
  - `diff a b` to see value differences

Want me to wire persistent process management (pm2/systemd) or add a small integration test that verifies byte-for-byte equality between manual and watcher runs? Reply which you'd prefer and I will implement it.

# Mimosa pipeline (docker-compose)

This repository contains a small docker-compose-based scaffold that watches `jasen_out/<subfolder>/*.json`, runs an R script to convert JSONs into cgMLST profiles and fake metadata, and then runs Reportree (container) to compute clusters and notify if multi-sample clusters are found.

Quick overview

- `jasen_out_watcher.js` — Node watcher that scans `jasen_out` subfolders for new JSON files and runs `process_json.R`.
- `process_json.R` — R script that creates `cgmlst.profile.*` and `metadata.tsv.*` in `intermediate_files/profiles_for_reportree/<subfolder>`.
- `run_reportree.js` — Node script that finds profile+metadata pairs and runs Reportree via `docker run insapathogenomics/reportree ...`.
- `evaluate_alert_by_clust_dist.js` — helper to scan `_clusterComposition.tsv` and send notifications for multi-sample clusters.
- `Dockerfile.watcher` — image that contains R and Node so the watcher can run Rscript locally inside the container.
- `docker-compose.yml` — build+run configuration for the watcher (and optional r-env).

Usage (WSL / Linux)

1. Build and start the watcher container (project root where `docker-compose.yml` is located):

```bash
cd smittvarnings_app
docker compose build
docker compose up watcher
```

2. Add JSON files into `jasen_out/<subfolder>/` (create subfolder(s)). The watcher will detect new JSONs and run the R script.

Notes and important details

- The `run_reportree.js` uses `docker run insapathogenomics/reportree` to run Reportree. For this to succeed from inside the watcher container you must either:

  - Run `run_reportree.js` on the host machine (where Docker is available), or
  - Run the watcher container with the Docker socket mounted: `- /var/run/docker.sock:/var/run/docker.sock` to allow the container to control the host Docker daemon, or
  - Install and configure Docker-in-Docker (not recommended for simple setups).

- On WSL the easiest path is to run the watcher in the container but execute `run_reportree.js` from the host (or mount the socket as above). The R script runs inside the watcher container (R is installed there).

Next steps / suggestions

- Add tests (unit tests for parsing) and small example JSONs under `tests/` to validate pipeline.
- Add a small systemd/watchdog or supervisor so the watcher restarts on failure.
- Replace fake metadata generation with real metadata input if available.
