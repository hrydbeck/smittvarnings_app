#!/usr/bin/env bash
set -eu

# Clean backup_jasen_out by removing any files that are byte-identical to files
# tracked in this repository. Optionally copy the folder to a new name first.
# Usage: scripts/clean_backup_jasen_out.sh [--copy-to <path>] [--dry-run]

BASEDIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$BASEDIR/backup_jasen_out"
COPY_TO=""
DRY_RUN=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --copy-to) COPY_TO="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) echo "Usage: $0 [--copy-to <path>] [--dry-run]"; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [ ! -d "$TARGET" ]; then
  echo "No backup folder found at: $TARGET"
  exit 1
fi

if [ -n "$COPY_TO" ]; then
  DEST="$BASEDIR/$COPY_TO"
  echo "Copying $TARGET -> $DEST (non-destructive)"
  if [ "$DRY_RUN" -eq 0 ]; then
    mkdir -p "$DEST"
    cp -a "$TARGET"/* "$DEST/" || true
  fi
  # operate on the copied location from here on
  TARGET="$DEST"
fi

echo "Building hash index of tracked repository files (this may take a moment)..."
TMPFILE=$(mktemp)
git -C "$BASEDIR" ls-files -z | xargs -0 sha1sum | awk '{print $1}' | sort -u > "$TMPFILE"

echo "Scanning $TARGET for files that are identical to repo-tracked files..."
find "$TARGET" -type f | while read -r f; do
  h=$(sha1sum "$f" | awk '{print $1}')
  if grep -q -x "$h" "$TMPFILE"; then
    if [ "$DRY_RUN" -eq 1 ]; then
      echo "[DRY] would remove: $f (duplicate of tracked repo file)"
    else
      echo "Removing duplicate repo-derived file: $f"
      rm -f "$f"
    fi
  fi
done

rm -f "$TMPFILE"
echo "Done. You may want to add the backup folder to .gitignore if you haven't already."
