# Smittvarnings App — local pipeline

Lightweight local pipeline that converts jasen JSON outputs into cgMLST profiles and runs ReporTree clustering.

This README is now a short landing page. Detailed usage, demo/verify instructions and Docker alternatives live in the `docs/` folder:

- `docs/USAGE.md` — usage, simulation helpers, verify/demo scripts, watchers vs one-shot runners, npm shortcuts and troubleshooting.
- `docs/DOCKER.md` — explains Docker Compose vs `docker run` alternatives, how to run containers as your UID, and recommended patterns for local vs continuous deployments.

Quick pointers:

- Convert JSONs manually:

  Rscript R/process_json.R intermediate_files/profiles_for_reportree <label> jasen_out/s_aureus/\*.json

- Run the one-shot initial runner (process current profiles once and exit):

  npm run run-reportree:initial:once

- Run the one-shot additional runner (uses partitions/nomenclature produced by the initial run):

  npm run run-reportree:additional:once

- Run the demo (initial → additional):

  npm run demo:run

For full details, examples and the new Docker Compose alternatives section, see `docs/USAGE.md` and `docs/DOCKER.md`.
