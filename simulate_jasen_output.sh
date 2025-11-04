#!/bin/bash
# Backward-compatible wrapper: delegate to scripts/simulate_jasen_output.sh
exec "$(dirname "$0")/scripts/simulate_jasen_output.sh" "$@"
