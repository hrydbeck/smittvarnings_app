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
