#!/bin/bash
set -eu pipefail # o

# simulate jasen output by copying the backup s_aureus folder into jasen_out
BASEDIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$BASEDIR/backup_jasen_out/s_aureus"
DST="$BASEDIR/jasen_out"

if [ ! -d "$SRC" ]; then
  echo "Source folder not found: $SRC"
  exit 1
fi

echo "Stopping local watchers (if running)..."
pkill -f "node jasen_out_watcher.js" || true
pkill -f "node run_reportree.js" || true

echo "Cleaning destination folder: $DST"
mkdir -p "$DST"
# remove all entries under jasen_out but keep jasen_out itself
find "$DST" -mindepth 1 -maxdepth 1 -exec rm -rf {} +

echo "Copying $SRC -> $DST/"
# copy the s_aureus folder into jasen_out so jasen_out/s_aureus exists
cp -a "$SRC" "$DST/"

echo "Setting permissions: writable by current user"
chown -R $(id -u):$(id -g) "$DST" || true
chmod -R g+rwX,u+rwX "$DST" || true

echo "Done. Current jasen_out contents:"
ls -la "$DST"

echo "If you want the watchers to pick this up automatically, start them:" 
echo "nohup node run_reportree.js > run_reportree.log 2>&1 &"
echo "nohup node jasen_out_watcher.js > jasen_out_watcher.log 2>&1 &"
