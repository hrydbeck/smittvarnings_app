#!/usr/bin/env bash
# Small verification script: simulate initial inputs, run JSON->profile conversion,
# run the initial Reportree runner (with timeout) and check for partitions.
set -euo pipefail
shopt -s nullglob

BASEDIR="$(cd "$(dirname "$0")/.." && pwd)"
LOGDIR="$BASEDIR/logs"
mkdir -p "$LOGDIR"

echo "== verify_initial: starting =="

echo "1) Simulate initial jasen outputs"
bash "$BASEDIR/scripts/simulate_jasen_initial.sh"

echo "2) Run R conversion (JSON -> cgMLST profiles)"
JSON_FILES=("$BASEDIR/jasen_out/s_aureus"/*_result.json)
if [ ${#JSON_FILES[@]} -eq 0 ]; then
  echo "No JSON files found in $BASEDIR/jasen_out/s_aureus - aborting"
  exit 1
fi

mkdir -p "$BASEDIR/intermediate_files/profiles_for_reportree"
echo "Calling Rscript process_json.R with ${#JSON_FILES[@]} files"
Rscript "$BASEDIR/R/process_json.R" "$BASEDIR/intermediate_files/profiles_for_reportree" "s_aureus_1" "${JSON_FILES[@]}"

echo "Profiles written to:"
ls -1 "$BASEDIR/intermediate_files/profiles_for_reportree/s_aureus" || true

echo "3) Run initial Reportree runner (timeout 300s)"
VERIFY_LOG="$LOGDIR/verify_initial.log"
timeout 300s node "$BASEDIR/bin/run_reportree_initial_once.js" > "$VERIFY_LOG" 2>&1 || true
echo "Reportree runner finished (or timed out). Log: $VERIFY_LOG"

echo "4) Check for partitions under intermediate_files/clusters/s_aureus"
PARTS=$(find "$BASEDIR/intermediate_files/clusters/s_aureus" -maxdepth 2 -type f -name '*_partitions.tsv' 2>/dev/null || true)
if [ -n "$PARTS" ]; then
  echo "✅ Partitions found:"
  echo "$PARTS"
  echo "VERIFY: initial run SUCCESS"
  exit 0
else
  echo "❌ No partitions found under intermediate_files/clusters/s_aureus"
  echo "Tail of verify log (last 200 lines):"
  tail -n 200 "$VERIFY_LOG" || true
  echo "VERIFY: initial run FAILED"
  exit 2
fi
