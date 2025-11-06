### Smittvarnings App — local pipeline# Smittvarnings App — local pipeline

Small local pipeline for converting jasen JSON outputs into cgMLST profiles and running ReporTree clustering.Small local pipeline for converting jasen JSON outputs into cgMLST profiles and running ReporTree clustering.

## OverviewKey ideas

- Inputs: jasen JSON files placed under `jasen_out/<subfolder>/` (example: `jasen_out/s_aureus/`).- Input JSONs: `jasen_out/<subfolder>/*.json` (e.g. `jasen_out/s_aureus/`)

- Conversion: `R/process_json.R` parses jasen JSON(s) and writes two files under `intermediate_files/profiles_for_reportree/<sub>/`:- R conversion: `process_json.R` reads JSON(s) and writes

  - `cgmlst.profile.<sub>_YYYY-MM-DD_<n>` — tab-separated profile table

  - `metadata.tsv.<sub>_YYYY-MM-DD_<n>` — metadata used by ReporTree - `intermediate_files/profiles_for_reportree/<sub>/cgmlst.profile.<label>_YYYY-MM-DD_YYYY-MM-DD`

- Clustering: ReporTree consumes the profile+metadata pair and writes outputs under `intermediate_files/clusters/<sub>/<label>/` (partitions, cluster composition, trees, logs, etc.).

  ```markdown

  ```

## Prerequisites # Smittvarnings App — local pipeline

- Linux / WSL or macOS with Docker. Small local pipeline for converting jasen JSON outputs into cgMLST profiles and running ReporTree clustering.

- Docker & Docker Compose (compose v2 recommended).

- Node.js (watcher and helpers tested on Node 18). Key ideas

- R (Rscript). The watcher image installs the R packages used by `R/process_json.R` (rjson, readr, lubridate, tibble, dplyr, tidyr).

  - Input JSONs: `jasen_out/<subfolder>/*.json` (e.g. `jasen_out/s_aureus/`)

## Quick start - R conversion: `R/process_json.R` reads JSON(s) and writes

    - `intermediate_files/profiles_for_reportree/<sub>/cgmlst.profile.<label>_YYYY-MM-DD_YYYY-MM-DD`

1. Reset the workspace (optional) and copy deterministic test fixtures (examples provided in `backup_jasen_out/`): - `intermediate_files/profiles_for_reportree/<sub>/metadata.tsv.<label>_...`

- Clustering: `reportree` (via `scripts/reportree_watcher.sh` or `bin/run_reportree.js`) consumes profile+metadata pairs and writes cluster outputs to

```bash    - `intermediate_files/clusters/<sub>/<label>/` (clusterComposition, partitions, logs, etc.)

sh scripts/reset_workspace.sh --wipe

sh scripts/simulate_jasen_initial.sh # initial test fixtures Prerequisites

sh scripts/simulate_jasen_additional.sh # additional fixtures (optional)

````- Linux / WSL or macOS with Docker.

  - Docker & Docker Compose (compose v2 recommended).

## Simulation helpers  - Node.js (watcher and helpers tested on Node 18).

  - R (Rscript). The watcher image installs R packages used by `R/process_json.R` (rjson, readr, lubridate, tibble, dplyr, tidyr, purrr).

- `scripts/simulate_jasen_initial.sh` — copies a deterministic initial set of fixtures into `jasen_out/s_aureus/`. This script resets the destination first so the test is deterministic.

- `scripts/simulate_jasen_additional.sh` — copies additional fixtures into `jasen_out/s_aureus/` (does not clear existing files).  Quick start (compose-based, recommended)



## Watcher vs one-shot runners  1. Reset the workspace and copy deterministic test fixtures:



- Watchers (long-running):  ```bash

  - `bin/run_reportree_initial_samples.js` and `bin/run_reportree_additional_samples.js` poll the profiles folder and run ReporTree when new profile+metadata pairs appear. These are intended for continuous operation and won't exit on their own.  sh scripts/reset_workspace.sh --wipe

  sh scripts/simulate_jasen_output.sh

- One-shot runners (exit after processing):  ```

  - `bin/run_reportree_initial_once.js` and `bin/run_reportree_additional_once.js` process all currently available profile+metadata pairs once and then exit. Use these in CI, demos, or when you want a run to finish and return a status.

  New: separate simulation helpers

## Verification & demo scripts

  - `scripts/simulate_jasen_initial.sh` — copy a deterministic initial set of fixtures (defaults: 145,146,147). Use `./scripts/simulate_jasen_initial.sh` or pass ids: `./scripts/simulate_jasen_initial.sh 145 146`.

- `scripts/verify_initial.sh` — simulate initial fixtures, run `R/process_json.R` (label `s_aureus_1`), run the one-shot initial runner (timeout), and verify that `_partitions.tsv` appears under `intermediate_files/clusters/s_aureus/`. Log: `logs/verify_initial.log`.  - `scripts/simulate_jasen_additional.sh` — copy an additional set (defaults: 148,149,150). Use `./scripts/simulate_jasen_additional.sh` or pass ids.



- `scripts/verify_additional.sh` — run the initial flow to create partitions, simulate additional fixtures, run conversion (label `s_aureus_2`), run the one-shot additional runner, and verify that the runner used the existing nomenclature/partitions file. Logs: `logs/verify_additional_init.log` and `logs/verify_additional.log`.  Verification and demo scripts



- `scripts/run_demo_initial_then_additional.sh` — convenience demo that resets `jasen_out` and intermediate folders, runs the initial flow, then runs the additional flow, and prints a short summary. Logs: `logs/run_demo_initial.log`, `logs/run_demo_additional.log`.  This repository includes a set of small helper scripts to run deterministic, reproducible demonstrations of the pipeline and to perform quick one-shot verifications. They are intended for local testing — use the long-running watcher processes for production/continuous usage.



## Usage examples  Simulation helpers



```bash  - `scripts/simulate_jasen_initial.sh` — copy a deterministic initial set of fixtures into `jasen_out/s_aureus/`. This script intentionally resets (`rm -rf`) the destination folder first so the initial test is deterministic.

# Run an initial verification (convert JSONs and run ReporTree once)  - `scripts/simulate_jasen_additional.sh` — copy additional fixtures into `jasen_out/s_aureus/`. This script copies files on top of any existing files (does not clear the folder), so it can be used to add more samples after an initial run.

chmod +x scripts/verify_initial.sh

./scripts/verify_initial.sh  One-shot vs watcher runners



# Run the additional verification (initial -> additional)  - Watcher (long-running):

chmod +x scripts/verify_additional.sh

./scripts/verify_additional.sh    - `bin/run_reportree_initial_samples.js` and `bin/run_reportree_additional_samples.js` are watchers that poll `intermediate_files/profiles_for_reportree/*` on an interval and run ReporTree when new profile+metadata pairs appear. They are useful for continuous operation but do not exit on their own.



# Run the combined demo (resets folders then run initial + additional)  - One-shot (exit after processing):

chmod +x scripts/run_demo_initial_then_additional.sh    - `bin/run_reportree_initial_once.js` and `bin/run_reportree_additional_once.js` are one-shot runners that process all currently-available profile+metadata pairs once and then exit. These are convenient for demo scripts and CI where you want runs to finish and return an exit code.

./scripts/run_demo_initial_then_additional.sh

```  Verification scripts



## NPM script shortcuts  - `scripts/verify_initial.sh` — runs the initial simulation, calls `R/process_json.R` to write profiles (label `s_aureus_1`), invokes the one-shot initial runner with a timeout, and checks for `_partitions.tsv` files under `intermediate_files/clusters/s_aureus/`. Logs are written to `logs/verify_initial.log`.



You can also invoke runners and verification scripts via npm (shortcuts defined in `package.json`):  - `scripts/verify_additional.sh` — runs the initial flow first to ensure partitions exist, then simulates additional fixtures, converts them (label `s_aureus_2`), runs the one-shot additional runner with a timeout, and verifies that the additional run used a nomenclature/partitions file (by inspecting the runner log and created cluster outputs). Logs are written to `logs/verify_additional.log` and `logs/verify_additional_init.log`.



| Command | Action |  Demo script

|---|---|

| `npm run start` | Start the long-running watcher (`bin/jasen_out_watcher.js`). |  - `scripts/run_demo_initial_then_additional.sh` — convenience script that resets the key folders (`jasen_out/s_aureus`, `intermediate_files/profiles_for_reportree/s_aureus`, `intermediate_files/clusters/s_aureus`), runs the initial simulation + conversion + one-shot initial runner, then runs the additional simulation + conversion + one-shot additional runner. It writes demo logs to `logs/run_demo_initial.log` and `logs/run_demo_additional.log` and prints a short summary of cluster outputs.

| `npm run run-reportree:initial` | Start the initial ReporTree watcher (long-running). |

| `npm run run-reportree:additional` | Start the additional ReporTree watcher (long-running). |  Usage examples

| `npm run run-reportree:initial:once` | One-shot initial runner: process current profiles once and exit. |

| `npm run run-reportree:additional:once` | One-shot additional runner: process current profiles once and exit (requires partitions). |  ```bash

| `npm run verify:initial` | Run `scripts/verify_initial.sh`. |  # Run a quick verification of the initial flow (converts JSONs, runs ReporTree once)

| `npm run verify:additional` | Run `scripts/verify_additional.sh`. |  chmod +x scripts/verify_initial.sh

| `npm run demo:run` | Run `scripts/run_demo_initial_then_additional.sh`. |  ./scripts/verify_initial.sh



## Notes & troubleshooting  # Run the more thorough additional-runner verification (initial -> additional)

  chmod +x scripts/verify_additional.sh

- Logs from demo/verify scripts are in `logs/`. If a run times out (default timeouts are 300s) the script prints the log tail for debugging.  ./scripts/verify_additional.sh

- If you want continuous processing, start the watcher scripts with a supervisor (e.g., `nohup`, `systemd`, or `pm2`). Use one-shot runners for CI or demos.

- If ReporTree runs create files owned by `root`, run:  # Run the combined demo (resets folders then run initial + additional)

  chmod +x scripts/run_demo_initial_then_additional.sh

```bash  ./scripts/run_demo_initial_then_additional.sh

sudo chown -R $(id -u):$(id -g) intermediate_files jasen_out logs  ```

````

Quick script summary

- If R packages are missing inside the watcher image, rebuild it so the Dockerfile installs required R packages.

  | Script (npm) | Action |

## Email alerts | --------------------------------------- | ----------------------------------------------------------------------------------------- |

| `npm run start` | Start the long-running watcher (`bin/jasen_out_watcher.js`). |

The evaluator can send email alerts when SMTP settings are provided via environment variables or a `.env` file. Example `.env` entries: | `npm run run-reportree:initial` | Start the initial ReporTree watcher (long-running). |

| `npm run run-reportree:additional` | Start the additional ReporTree watcher (long-running). |

```ini  | `npm run run-reportree:initial:once` | One-shot initial runner: process current profiles once and exit. |

SMTP_HOST=smtp.example.org | `npm run run-reportree:additional:once` | One-shot additional runner: process current profiles once and exit (requires partitions). |

SMTP_PORT=587 | `npm run verify:initial` | Run `scripts/verify_initial.sh` (simulate initial → convert → one-shot initial run). |

SMTP_USER=optional_user | `npm run verify:additional` | Run `scripts/verify_additional.sh` (initial → additional verification). |

SMTP_PASS=optional_pass | `npm run demo:run` | Run the combined demo `scripts/run_demo_initial_then_additional.sh`. |

SMTP_FROM=smittvarnings@example.org

ALERT_EMAIL=you@example.org Notes

`````

  - Logs: demo/verify scripts write to `logs/` (see files named above). If a run times out (default timeouts are 300s), the log is printed or tailed for debugging.

Quick test (send a test email):  - Use the watcher scripts (`bin/run_reportree_initial_samples.js` / `bin/run_reportree_additional_samples.js`) if you want continuous processing — start them with `nohup` or a supervisor. Use the one-shot scripts for CI, demos, or when you want the command to exit after processing.

  - The simulation helpers and verify/demo scripts are safe for local testing only; they manipulate `jasen_out/` and `intermediate_files/` and may remove existing content when running the initial simulation (intentional for deterministic tests).

```bash

node scripts/send_test_email.js  Run the initial runner with `npm run run-reportree:initial` and the additional mode with `npm run run-reportree:additional`. These map to `bin/run_reportree_initial_samples.js` and `bin/run_reportree_additional_samples.js` respectively.

# or with dotenv loader  ````

node -r dotenv/config scripts/send_test_email.js

```  2. Build and start the watcher + reportree service (run as your host UID/GID — see note below):



## Housekeeping  ```bash

  LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) docker compose up -d --build watcher reportree-service

- Remove orphan containers:  ```



```bash  3. Follow logs to watch conversion and clustering:

docker compose down --remove-orphans

```  ```bash

  docker compose logs -f watcher reportree-service --no-color

- Create a local `.env` from the example (do not commit it):  ```



```bash  Try it — check outputs

cp .env.example .env

chmod 600 .env  ```bash

```  # List generated profiles

  ls intermediate_files/profiles_for_reportree/s_aureus/

## CI / integration

  # Inspect cluster composition for the latest label (replace <label> with the actual file prefix)

- A basic integration workflow is present at `.github/workflows/integration.yml`. It resets the workspace, builds images, copies fixtures, and verifies outputs. You may need to tune timeouts on CI runners.  head -n 40 intermediate_files/clusters/s_aureus/<label>_clusterComposition.tsv

`````

## Contributing

Manual / single-shot commands

If you want me to add unit tests for the JSON → profile parsing, wire a supervisor (`pm2`/systemd), or add a CI integration job, tell me which you'd prefer and I can implement it.

Convert JSONs to profiles directly (single run):

```bash
Rscript R/process_json.R intermediate_files/profiles_for_reportree <label> jasen_out/s_aureus/*.json
```

Run ReporTree manually (example using the official image; ensure the container writes files as the host user):

```bash
docker run --rm -v $(pwd)/intermediate_files:/data -w /data --user $(id -u):$(id -g) \
  insapathogenomics/reportree reportree.py -m /data/profiles_for_reportree/s_aureus/<metadata> \
  -a /data/profiles_for_reportree/s_aureus/<profile> -out /data/clusters/s_aureus/<label> \
  --analysis grapetree --method MSTreeV2 -thr 10
```

Important notes

- Canonical fixtures: treat `backup_jasen_out/` as read-only test fixtures. Use `scripts/simulate_jasen_output.sh` to copy them into `jasen_out/` when testing.
- Determinism: the watcher sorts subfolders and filenames before invoking `R/process_json.R` so file ordering is stable.
- Timezones: the watcher sets `TZ=UTC` for spawned R processes if unset to avoid local inconsistencies.

- Email alerts: the evaluator can send email when SMTP configuration is provided. To enable email alerts set the following environment variables (one way is a `.env` file in the repo root):

  ```ini
  SMTP_HOST=smtp.example.org
  SMTP_PORT=587
  SMTP_USER=optional_user
  SMTP_PASS=optional_pass
  SMTP_FROM=smittvarnings@example.org
  ALERT_EMAIL=you@example.org
  ```

  The alert module will still produce local desktop/console notifications even when SMTP is not configured; email sending requires `nodemailer` to be available in the runtime image.

Quick test (send a test email)

- A small helper script is included at `scripts/send_test_email.js`. It loads your local `.env` (via dotenv) and sends a single test message to `ALERT_EMAIL`.

- Run the test safely with:

  ```bash
  node scripts/send_test_email.js
  ```

  Or (explicitly use dotenv loader):

  ```bash
  node -r dotenv/config scripts/send_test_email.js
  ```

- This avoids sourcing `.env` in your shell (which can break when values contain spaces). The script prints a short success or failure message.

### Running containers as your user

Compose supports substituting environment variables into the `user:` field. Set `LOCAL_UID` and `LOCAL_GID` when starting compose to have containers write files as your host user. If unset, services fall back to UID/GID 1000.

One-off start:

```bash
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) docker compose up -d --build watcher reportree-service
```

Or create a `.env` file in the repo root containing:

```
LOCAL_UID=1000
LOCAL_GID=1000
```

This helps avoid files being written as `root` on the host when containers create output under `intermediate_files/` or `logs/`.

Troubleshooting

- Missing R packages inside the watcher image: rebuild the watcher image (`docker compose up -d --build watcher`) so the Dockerfile installs the required R packages.
- If you see no clusters produced: check the watcher logs and ensure `R/process_json.R` wrote both the `cgmlst.profile.*` and the corresponding `metadata.tsv.*` in `intermediate_files/profiles_for_reportree/<sub>/`.

Housekeeping

- Remove orphan containers created during iterative testing:

```bash
docker compose down --remove-orphans
```

- If you need to fix ownership of files under `intermediate_files` (e.g., created by a previous root-owned run), run:

```bash
sudo chown -R $(id -u):$(id -g) intermediate_files jasen_out logs
```

Creating a local `.env` from `.env.example`

- To enable email alerts or set `LOCAL_UID`/`LOCAL_GID` for Docker compose, copy the example and edit it locally (do not commit):

  ```bash
  cp .env.example .env
  # edit .env with your secrets and preferences
  chmod 600 .env
  ```

- The repository already contains `.env` in `.gitignore`, so your local `.env` will remain untracked. If you ever accidentally commit secrets, rotate the secret and contact collaborators.

CI / integration

- A basic integration workflow lives at `.github/workflows/integration.yml`. It resets the workspace, builds the images, copies fixtures, and verifies cluster outputs. You may need to tune timeouts on GitHub Actions runners because building images and running containers can take several minutes.

Next steps / suggestions

- Add small unit tests for the JSON → profile parsing and a CI job that asserts that watcher runs produce the same profile as a manual `Rscript` invocation.
- Consider a lightweight process supervisor (systemd unit or `pm2`) to keep the watcher running on a host.

Contributing

If you want me to also add a short integration test or wire `pm2`/systemd unit files and update the CI accordingly, tell me which you prefer and I'll implement it.

```

```
