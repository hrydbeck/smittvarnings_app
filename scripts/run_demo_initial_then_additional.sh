#!/usr/bin/env bash
# Run a full demo: reset folders, run initial flow, then additional flow.
set -euo pipefail
shopt -s nullglob

BASEDIR="$(cd "$(dirname "$0")/.." && pwd)"
LOGDIR="$BASEDIR/logs"
mkdir -p "$LOGDIR"

echo "== run_demo_initial_then_additional: starting =="

echo "Resetting target folders (jasen_out, intermediate profiles, clusters, logs)"
rm -rf "$BASEDIR/jasen_out/s_aureus" || true
rm -rf "$BASEDIR/intermediate_files/profiles_for_reportree/s_aureus" || true
rm -rf "$BASEDIR/intermediate_files/clusters/s_aureus" || true
mkdir -p "$BASEDIR/jasen_out/s_aureus"
mkdir -p "$BASEDIR/intermediate_files/profiles_for_reportree/s_aureus"
mkdir -p "$BASEDIR/intermediate_files/clusters/s_aureus"

echo "1) Run initial simulation + conversion + initial-runner"
bash "$BASEDIR/scripts/simulate_jasen_initial.sh"
JSON_FILES=("$BASEDIR/jasen_out/s_aureus"/*_result.json)
if [ ${#JSON_FILES[@]} -eq 0 ]; then
  echo "No JSONs found after simulate_jasen_initial.sh - aborting"
  exit 1
fi

echo "Converting initial JSONs to profiles (label s_aureus_1)"
Rscript "$BASEDIR/R/process_json.R" "$BASEDIR/intermediate_files/profiles_for_reportree" "s_aureus_1" "${JSON_FILES[@]}"

LOG_INIT="$LOGDIR/run_demo_initial.log"
echo "Running initial Reportree runner (timeout 300s), log -> $LOG_INIT"
timeout 300s node "$BASEDIR/bin/run_reportree_initial_once.js" > "$LOG_INIT" 2>&1 || true

echo "Initial run finished. Partitions present:" 
find "$BASEDIR/intermediate_files/clusters/s_aureus" -type f -name '*_partitions.tsv' -print || echo "(none)"

echo "2) Run additional simulation + conversion + additional-runner"
bash "$BASEDIR/scripts/simulate_jasen_additional.sh"
JSON_FILES=("$BASEDIR/jasen_out/s_aureus"/*_result.json)
echo "Converting additional JSONs to profiles (label s_aureus_2)"
Rscript "$BASEDIR/R/process_json.R" "$BASEDIR/intermediate_files/profiles_for_reportree" "s_aureus_2" "${JSON_FILES[@]}"

LOG_ADD="$LOGDIR/run_demo_additional.log"
echo "Running additional Reportree runner (timeout 300s), log -> $LOG_ADD"
timeout 300s node "$BASEDIR/bin/run_reportree_additional_once.js" > "$LOG_ADD" 2>&1 || true

echo "Inspect additional-runner log for nomenclature usage"
if grep -i -E "nomenclature|--nomenclature-file|Nomenclature file provided" "$LOG_ADD" >/dev/null 2>&1; then
  echo "✅ Additional-runner used nomenclature/partitions (see $LOG_ADD)"
else
  echo "❌ Additional-runner did NOT report nomenclature usage. See $LOG_ADD"
fi

echo "Cluster outputs (latest):"
ls -l "$BASEDIR/intermediate_files/clusters/s_aureus" || true

echo "== demo finished =="
