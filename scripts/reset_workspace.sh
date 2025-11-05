#!/bin/bash

# Usage: scripts/reset_workspace.sh [--wipe]
WIPE=0
if [ "$1" = "--wipe" ] || [ "$1" = "-w" ]; then
    WIPE=1
fi

echo "Stopping watchers..."
pkill -f "node bin/jasen_out_watcher.js" || true
pkill -f "node bin/run_reportree.js" || true

if [ "$WIPE" -eq 0 ]; then
    echo "Saving current s_aureus files..."
    TEMP_DIR=$(mktemp -d)
    if [ -d "jasen_out/s_aureus" ]; then
            cp -r jasen_out/s_aureus/* "$TEMP_DIR/"
    fi
else
    echo "Wipe mode: existing jasen_out contents will be removed and not restored."
fi

echo "Clearing directories..."
if [ -d "jasen_out" ]; then
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

echo "Clearing logs..."
mkdir -p logs
if rm -rf logs/* 2>/dev/null; then
    :
else
    echo "⚠️ Could not remove some logs due to permissions. Attempting to fix ownership..."
    if command -v sudo >/dev/null 2>&1; then
        sudo chown -R $(id -u):$(id -g) logs || true
        sudo rm -rf logs/* || true
    else
        echo "No sudo available. Please remove logs/ contents manually if needed."
    fi
fi

echo "Recreating directory structure..."
mkdir -p jasen_out
mkdir -p intermediate_files/profiles_for_reportree
mkdir -p intermediate_files/clusters

if [ "$WIPE" -eq 0 ]; then
    echo "Restoring s_aureus files..."
    if [ -d "$TEMP_DIR" ] && [ "$(ls -A $TEMP_DIR)" ]; then
            mkdir -p jasen_out/s_aureus
            cp -r "$TEMP_DIR"/* jasen_out/s_aureus/
            rm -rf "$TEMP_DIR"
    fi
fi

echo "Reset complete. Directory structure:"
tree jasen_out intermediate_files || true

echo -e "\nTo start the watchers:"
echo "1. Start reportree watcher:  node bin/run_reportree.js > logs/run_reportree.log 2>&1 &"
echo "2. Start jasen watcher:      node bin/jasen_out_watcher.js > logs/jasen_out_watcher.log 2>&1 &"
echo "3. Monitor logs:             tail -f logs/jasen_out_watcher.log logs/run_reportree.log"
