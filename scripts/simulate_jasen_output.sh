#!/bin/bash
set -eu pipefail

# simulate jasen output by copying a configured source folder into jasen_out
# This script lives in `scripts/`, so BASEDIR is the repo root.
BASEDIR="$(cd "$(dirname "$0")/.." && pwd)"

# Load config (optional). The config can set SRC_DIR and SUBDIR. Example file:
# SRC_DIR=./simulated_jasen_data
# # Optional (commented): use the real backup folder instead
# #SRC_DIR=./real_jasen_out_for_testing
# SUBDIR=speciesA
CONFIG_FILE="$BASEDIR/scripts/simulate_jasen_output.conf"
if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

# sensible defaults
: "${SRC_DIR:=./simulated_jasen_data}"
: "${SUBDIR:=speciesA}"

SRC="$BASEDIR/${SRC_DIR}/${SUBDIR}/initial"
DST="$BASEDIR/jasen_out"

# If the configured simulated data is missing but we have an existing backup, try
# to populate the simulated dataset automatically (non-destructive copy).
if [ ! -d "$SRC" ]; then
  BACKUP1="$BASEDIR/backup_jasen_out/s_aureus_initial"
  BACKUP2="$BASEDIR/backup_jasen_out/s_aureus_additional"
  if [ -d "$BACKUP1" ] || [ -d "$BACKUP2" ]; then
    echo "Populating ${SRC_DIR}/${SUBDIR}/{initial,additional} from backup_jasen_out..."
    mkdir -p "$BASEDIR/${SRC_DIR}/${SUBDIR}/initial"
    mkdir -p "$BASEDIR/${SRC_DIR}/${SUBDIR}/additional"
    if [ -d "$BACKUP1" ]; then
      cp -a "$BACKUP1"/* "$BASEDIR/${SRC_DIR}/${SUBDIR}/initial/" 2>/dev/null || true
    fi
    if [ -d "$BACKUP2" ]; then
      cp -a "$BACKUP2"/* "$BASEDIR/${SRC_DIR}/${SUBDIR}/additional/" 2>/dev/null || true
    fi
    SRC="$BASEDIR/${SRC_DIR}/${SUBDIR}/initial"
  fi
fi

if [ ! -d "$SRC" ]; then
  echo "Source folder not found: $SRC"
  echo "Create a config at $CONFIG_FILE or populate $BASEDIR/${SRC_DIR}/${SUBDIR}/initial with sample JSONs."
  exit 1
fi

echo "Stopping local watchers (if running)..."
# prefer exact bin paths for our canonical entrypoints
pkill -f "node bin/jasen_out_watcher.js" || true
pkill -f "node bin/run_reportree.js" || true

echo "Cleaning destination folder: $DST"
mkdir -p "$DST"
# remove all entries under jasen_out but keep jasen_out itself
find "$DST" -mindepth 1 -maxdepth 1 -exec rm -rf {} +

echo "Copying $SRC -> $DST/"
# copy the configured source species folder into jasen_out so jasen_out/<sub> exists
cp -a "$SRC" "$DST/"

echo "Setting permissions: writable by current user"
chown -R $(id -u):$(id -g) "$DST" || true
chmod -R g+rwX,u+rwX "$DST" || true

echo "Done. Current jasen_out contents:"
ls -la "$DST"

echo "If you want the watchers to pick this up automatically, start them:" 
echo "Preparing logs directory..."
mkdir -p "$BASEDIR/logs" || true
echo "nohup node bin/run_reportree.js > logs/run_reportree.log 2>&1 &"
echo "nohup node bin/jasen_out_watcher.js > logs/jasen_out_watcher.log 2>&1 &"
