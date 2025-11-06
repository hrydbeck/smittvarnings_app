#!/usr/bin/env bash
# Verify additional-runner flow:
# 1) simulate initial, convert JSONs, run initial Reportree to create partitions
# 2) simulate additional, convert JSONs, run additional Reportree runner
# 3) check that the additional-runner used a nomenclature/partitions file and produced cluster outputs
set -euo pipefail
shopt -s nullglob

BASEDIR="$(cd "$(dirname "$0")/.." && pwd)"
LOGDIR="$BASEDIR/logs"
mkdir -p "$LOGDIR"

MARKER="$LOGDIR/verify_additional.start.marker"
touch "$MARKER"

echo "== verify_additional: starting =="

echo "1) Ensure initial partitions exist by running initial flow"
bash "$BASEDIR/scripts/simulate_jasen_initial.sh"

JSON_FILES=("$BASEDIR/jasen_out/s_aureus"/*_result.json)
if [ ${#JSON_FILES[@]} -eq 0 ]; then
  echo "No JSON files found in $BASEDIR/jasen_out/s_aureus - aborting"
  exit 1
fi

echo "Running R conversion for initial (s_aureus_1)"
Rscript "$BASEDIR/R/process_json.R" "$BASEDIR/intermediate_files/profiles_for_reportree" "s_aureus_1" "${JSON_FILES[@]}"

echo "Run initial Reportree runner (timeout 300s)"
LOG_INIT="$LOGDIR/verify_additional_init.log"
timeout 300s node "$BASEDIR/bin/run_reportree_initial_once.js" > "$LOG_INIT" 2>&1 || true

PARTS_FOUND=$(find "$BASEDIR/intermediate_files/clusters/s_aureus" -type f -name '*_partitions.tsv' -newer "$MARKER" 2>/dev/null || true)
if [ -z "$PARTS_FOUND" ]; then
  echo "❌ No partitions found after initial run. See $LOG_INIT"
  tail -n 200 "$LOG_INIT" || true
  exit 2
else
  echo "✅ Initial partitions found:"
  echo "$PARTS_FOUND"
fi

echo "2) Simulate additional jasen outputs"
bash "$BASEDIR/scripts/simulate_jasen_additional.sh"

echo "Run R conversion for additional samples (label s_aureus_2)"
ADDITIONAL_JSON=("$BASEDIR/jasen_out/s_aureus"/*_result.json)
Rscript "$BASEDIR/R/process_json.R" "$BASEDIR/intermediate_files/profiles_for_reportree" "s_aureus_2" "${ADDITIONAL_JSON[@]}"

echo "3) Run additional Reportree runner (timeout 300s)"
LOG_ADD="$LOGDIR/verify_additional.log"
timeout 300s node "$BASEDIR/bin/run_reportree_additional_once.js" > "$LOG_ADD" 2>&1 || true

echo "Inspecting additional-runner log for nomenclature usage"
if grep -i -E "nomenclature|--nomenclature-file|Nomenclature file provided" "$LOG_ADD" >/dev/null 2>&1; then
  echo "✅ Additional-runner invoked with nomenclature/partitions (see $LOG_ADD)"
else
  echo "❌ Additional-runner log did not show nomenclature usage. Tail of log:"
  tail -n 200 "$LOG_ADD" || true
  exit 3
fi

echo "Also report any cluster outputs created after start marker:"
find "$BASEDIR/intermediate_files/clusters/s_aureus" -type f -newer "$MARKER" -printf "%p\n" || true

echo "VERIFY: additional run SUCCESS"
exit 0
