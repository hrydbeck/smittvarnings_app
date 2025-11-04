#!/bin/bash

# Usage: reset_workspace.sh [--wipe]
# By default the script preserves existing jasen_out/<subfolder> contents (it saves and restores
# the `jasen_out/s_aureus` folder). Pass --wipe to remove all contents under `jasen_out`.

WIPE=0
if [ "$1" = "--wipe" ] || [ "$1" = "-w" ]; then
    WIPE=1
fi

echo "Stopping watchers..."
pkill -f "node jasen_out_watcher.js" || true
pkill -f "node run_reportree.js" || true

if [ "$WIPE" -eq 0 ]; then
    # Save current s_aureus files to temp location (preserve by default)
    echo "Saving current s_aureus files..."
    TEMP_DIR=$(mktemp -d)
    if [ -d "jasen_out/s_aureus" ]; then
            cp -r jasen_out/s_aureus/* "$TEMP_DIR/"
    fi
else
    echo "Wipe mode: existing jasen_out contents will be removed and not restored."
fi

# Clear jasen_out and intermediate_files
echo "Clearing directories..."
# Remove all contents (files and subfolders) under jasen_out but keep the jasen_out folder itself
if [ -d "jasen_out" ]; then
        # Try to remove normally; if permissions block us, attempt to fix ownership or try sudo
        if find jasen_out -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null; then
            :
        else
            echo "⚠️ Some files could not be removed due to permissions. Attempting to fix ownership..."
            if command -v sudo >/dev/null 2>&1; then
                sudo chown -R $(id -u):$(id -g) jasen_out intermediate_files || true
                sudo find jasen_out -mindepth 1 -maxdepth 1 -exec rm -rf {} + || true
            else
                echo "No sudo available. Please run this script with sufficient privileges or remove jasen_out contents manually."
            fi
        fi
else
    mkdir -p jasen_out
fi

# Clear intermediate files
if rm -rf intermediate_files/* 2>/dev/null; then
    :
else
    echo "⚠️ Could not remove some intermediate_files entries due to permissions. Trying to fix ownership..."
    if command -v sudo >/dev/null 2>&1; then
        sudo chown -R $(id -u):$(id -g) intermediate_files jasen_out || true
        sudo rm -rf intermediate_files/* || true
    else
        echo "No sudo available. Please run this script with sufficient privileges or remove intermediate_files contents manually."
    fi
fi

# Recreate directory structure
echo "Recreating directory structure..."
mkdir -p jasen_out
mkdir -p intermediate_files/profiles_for_reportree
mkdir -p intermediate_files/clusters

# Restore s_aureus files if we preserved them
if [ "$WIPE" -eq 0 ]; then
    echo "Restoring s_aureus files..."
    if [ -d "$TEMP_DIR" ] && [ "$(ls -A $TEMP_DIR)" ]; then
            mkdir -p jasen_out/s_aureus
            cp -r "$TEMP_DIR"/* jasen_out/s_aureus/
            rm -rf "$TEMP_DIR"
    fi
fi

echo "Reset complete. Directory structure:"
tree jasen_out intermediate_files

echo -e "\nTo start the watchers:"
echo "1. Start reportree watcher:  node run_reportree.js > run_reportree.log 2>&1 &"
echo "2. Start jasen watcher:      node jasen_out_watcher.js > jasen_out_watcher.log 2>&1 &"
echo "3. Monitor logs:             tail -f jasen_out_watcher.log run_reportree.log"