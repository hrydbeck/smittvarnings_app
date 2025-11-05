#!/bin/bash
set -eu pipefail

# Copy a small set of additional fixtures from backup_jasen_out into jasen_out
BASEDIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$BASEDIR/backup_jasen_out/s_aureus"
DST_DIR="$BASEDIR/jasen_out/s_aureus"

DEFAULT_IDS=(148 149 150)

ids=()
if [ "$#" -gt 0 ]; then
  ids=("$@")
else
  ids=("${DEFAULT_IDS[@]}")
fi

echo "Preparing jasen_out (additional) -> $DST_DIR"
mkdir -p "$DST_DIR"

echo "Stopping local watchers (if running)..."
pkill -f "node bin/jasen_out_watcher.js" || true
pkill -f "node bin/run_reportree" || true

echo "Copying additional fixtures into $DST_DIR"
for id in "${ids[@]}"; do
  fname="20_${id}_result.json"
  src="$SRC_DIR/$fname"
  if [ ! -f "$src" ]; then
    echo "Warning: fixture not found: $src — skipping"
    continue
  fi
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
