# Smittvarnings App — local pipeline

Small local pipeline for converting jasen JSON outputs into cgMLST profiles and running ReporTree clustering.

Key ideas

- Input JSONs: `jasen_out/<subfolder>/*.json` (e.g. `jasen_out/s_aureus/`)
- R conversion: `process_json.R` reads JSON(s) and writes

  - `intermediate_files/profiles_for_reportree/<sub>/cgmlst.profile.<label>_YYYY-MM-DD_YYYY-MM-DD`

  ````markdown
  # Smittvarnings App — local pipeline

  Small local pipeline for converting jasen JSON outputs into cgMLST profiles and running ReporTree clustering.

  Key ideas

  - Input JSONs: `jasen_out/<subfolder>/*.json` (e.g. `jasen_out/s_aureus/`)
  - R conversion: `R/process_json.R` reads JSON(s) and writes
    - `intermediate_files/profiles_for_reportree/<sub>/cgmlst.profile.<label>_YYYY-MM-DD_YYYY-MM-DD`
    - `intermediate_files/profiles_for_reportree/<sub>/metadata.tsv.<label>_...`
  - Clustering: `reportree` (via `scripts/reportree_watcher.sh` or `bin/run_reportree.js`) consumes profile+metadata pairs and writes cluster outputs to
    - `intermediate_files/clusters/<sub>/<label>/` (clusterComposition, partitions, logs, etc.)

  Prerequisites

  - Linux / WSL or macOS with Docker.
  - Docker & Docker Compose (compose v2 recommended).
  - Node.js (watcher and helpers tested on Node 18).
  - R (Rscript). The watcher image installs R packages used by `R/process_json.R` (rjson, readr, lubridate, tibble, dplyr, tidyr, purrr).

  Quick start (compose-based, recommended)

  1. Reset the workspace and copy deterministic test fixtures:

  ```bash
  sh scripts/reset_workspace.sh --wipe
  sh scripts/simulate_jasen_output.sh
  ```
  ````

  2. Build and start the watcher + reportree service (run as your host UID/GID — see note below):

  ```bash
  LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) docker compose up -d --build watcher reportree-service
  ```

  3. Follow logs to watch conversion and clustering:

  ```bash
  docker compose logs -f watcher reportree-service --no-color
  ```

  Try it — check outputs

  ```bash
  # List generated profiles
  ls intermediate_files/profiles_for_reportree/s_aureus/

  # Inspect cluster composition for the latest label (replace <label> with the actual file prefix)
  head -n 40 intermediate_files/clusters/s_aureus/<label>_clusterComposition.tsv
  ```

  Manual / single-shot commands

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
