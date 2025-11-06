#!/bin/bash
# Fail fast and make pipelines safe. Use 'o' form to avoid 'pipefail' being
# interpreted as a positional parameter in some shells.
set -euo pipefail

# Copy the whole initial fixtures directory into jasen_out (all *_result.json)
BASEDIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$BASEDIR/backup_jasen_out/s_aureus_initial"
DST_DIR="$BASEDIR/jasen_out/s_aureus"

echo "Preparing jasen_out (initial) -> $DST_DIR"
mkdir -p "$DST_DIR"

echo "Stopping local watchers (if running)..."
pkill -f "node bin/jasen_out_watcher.js" || true
pkill -f "node bin/run_reportree" || true

echo "Cleaning destination folder entries for s_aureus"
mkdir -p "$BASEDIR/jasen_out"
# remove existing s_aureus content so the test is deterministic
rm -rf "$DST_DIR" || true
mkdir -p "$DST_DIR"

for src in "$SRC_DIR"/*_result.json; do
  [ -e "$src" ] || continue
  echo "Copying $src -> $DST_DIR/"
  cp -a "$src" "$DST_DIR/"
done

chown -R $(id -u):$(id -g) "$BASEDIR/jasen_out" || true
chmod -R g+rwX,u+rwX "$BASEDIR/jasen_out" || true

echo "Done. jasen_out contents:"
ls -la "$DST_DIR"

echo "Start watchers if you want them to pick up the files:"
echo "nohup node bin/run_reportree_initial_samples.js > logs/run_reportree.log 2>&1 &"
echo "nohup node bin/jasen_out_watcher.js > logs/jasen_out_watcher.log 2>&1 &"
