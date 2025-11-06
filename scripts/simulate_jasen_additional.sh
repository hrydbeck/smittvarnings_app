#!/bin/bash
# Fail fast and make pipelines safe. Use the `o` form to ensure `pipefail`
# is parsed as an option and not accidentally as a positional argument.
set -euo pipefail

# Copy all additional fixtures from the backup into jasen_out (all *_result.json)
BASEDIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$BASEDIR/backup_jasen_out/s_aureus_additional"
DST_DIR="$BASEDIR/jasen_out/s_aureus"

echo "Preparing jasen_out (additional) -> $DST_DIR"
mkdir -p "$DST_DIR"

echo "Stopping local watchers (if running)..."
pkill -f "node bin/jasen_out_watcher.js" || true
pkill -f "node bin/run_reportree" || true

echo "Copying additional fixtures into $DST_DIR"
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
echo "nohup node bin/run_reportree_additional_samples.js > logs/run_reportree_additional.log 2>&1 &"
echo "nohup node bin/jasen_out_watcher.js > logs/jasen_out_watcher.log 2>&1 &"
