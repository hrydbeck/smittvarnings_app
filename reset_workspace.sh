#!/bin/bash

# Stop any running watchers
echo "Stopping watchers..."
pkill -f "node jasen_out_watcher.js" || true
pkill -f "node run_reportree.js" || true

# Save current s_aureus files to temp location
echo "Saving current s_aureus files..."
TEMP_DIR=$(mktemp -d)
if [ -d "jasen_out/s_aureus" ]; then
    cp -r jasen_out/s_aureus/* "$TEMP_DIR/"
fi

# Clear jasen_out and intermediate_files
echo "Clearing directories..."
# Remove all contents (files and subfolders) under jasen_out but keep the jasen_out folder itself
if [ -d "jasen_out" ]; then
    find jasen_out -mindepth 1 -maxdepth 1 -exec rm -rf {} +
else
    mkdir -p jasen_out
fi

# Clear intermediate files
rm -rf intermediate_files/* || true

# Recreate directory structure
echo "Recreating directory structure..."
mkdir -p jasen_out
mkdir -p intermediate_files/profiles_for_reportree
mkdir -p intermediate_files/clusters

# Restore s_aureus files
echo "Restoring s_aureus files..."
if [ -d "$TEMP_DIR" ] && [ "$(ls -A $TEMP_DIR)" ]; then
    cp -r "$TEMP_DIR"/* jasen_out/s_aureus/
    rm -rf "$TEMP_DIR"
fi

echo "Reset complete. Directory structure:"
tree jasen_out intermediate_files

echo -e "\nTo start the watchers:"
echo "1. Start reportree watcher:  node run_reportree.js > run_reportree.log 2>&1 &"
echo "2. Start jasen watcher:      node jasen_out_watcher.js > jasen_out_watcher.log 2>&1 &"
echo "3. Monitor logs:             tail -f jasen_out_watcher.log run_reportree.log"