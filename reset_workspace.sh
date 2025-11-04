#!/bin/bash
# Backward-compatible wrapper: delegate to scripts/reset_workspace.sh
exec "$(dirname "$0")/scripts/reset_workspace.sh" "$@"