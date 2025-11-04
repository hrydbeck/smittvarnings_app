#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob

# Simple watcher that runs ReporTree (already present in this image) against
# profile+metadata pairs found under /data/profiles_for_reportree.
#
# Behavior:
# - For each subfolder under /data/profiles_for_reportree, look for files named
#   cgmlst.profile.<label>_YYYY-MM-DD_YYYY-MM-DD and metadata.tsv.<label>_YYYY-... .
# - If a cluster output folder /data/clusters/<sub>/<label> does not exist, run
#   reportree.py with those inputs and write output to that folder.
# - Runs continuously with a sleep interval.

WATCH_DIR=${WATCH_DIR:-/data/profiles_for_reportree}
OUT_DIR=${OUT_DIR:-/data/clusters}
INTERVAL=${INTERVAL:-30}

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

mkdir -p "$OUT_DIR"

while true; do
  log "Scanning $WATCH_DIR for profile+metadata pairs..."
  for sub in "$WATCH_DIR"/*; do
    [ -d "$sub" ] || continue
    subname=$(basename "$sub")
    for profile in "$sub"/cgmlst.profile.*; do
      # profile name: cgmlst.profile.<label>_YYYY-MM-DD_YYYY-MM-DD
      fname=$(basename "$profile")
      if [[ "$fname" =~ ^cgmlst\.profile\.(.+)_[0-9]{4}-[0-9]{2}-[0-9]{2} ]]; then
        label="${BASH_REMATCH[1]}"
      else
        continue
      fi

      # pick first matching metadata file for this label
      meta=""
      for mf in "$sub"/metadata.tsv.*; do
        if [[ "$mf" == *"${label}"* ]]; then
          meta="$mf"
          break
        fi
      done
      [ -n "${meta-}" ] || continue

      host_out_dir="$OUT_DIR/$subname/$label"
      if [ -d "$host_out_dir" ]; then
        log "Skipping already-processed $subname/$label"
        continue
      fi

      mkdir -p "$host_out_dir"
      log "Running ReporTree for $subname/$label"
      # run reportree.py (present in this image)
      # GrapeTree/partitioning_grapetree may create temp files in the current
      # working directory (it uses tempfile.NamedTemporaryFile(dir='.')). The
      # application directory in this image may be read-only, so switch to the
      # mounted /data directory (writable) before running ReporTree.
      if pushd /data >/dev/null 2>&1; then
        if /usr/local/bin/python3 /app/ReporTree/reportree.py -m "/data/profiles_for_reportree/$subname/$(basename "$meta")" -a "/data/profiles_for_reportree/$subname/$(basename "$profile")" --columns_summary_report Region,n_Region -out "/data/clusters/$subname/$label" --analysis grapetree --method MSTreeV2 -thr 10; then
          log "ReporTree finished for $subname/$label"
        else
          log "ReporTree failed for $subname/$label — leaving output dir for inspection"
        fi
        popd >/dev/null 2>&1
      else
        log "Failed to change working directory to /data — cannot run ReporTree"
      fi
    done
  done

  sleep "$INTERVAL"
done
