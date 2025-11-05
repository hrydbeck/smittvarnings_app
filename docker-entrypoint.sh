#!/bin/bash
set -euo pipefail

# docker-entrypoint.sh
# If LOCAL_UID/LOCAL_GID are provided at container runtime, create a matching
# user inside the container and run the provided command as that user. This
# helps avoid files on mounted volumes being created as root on the host.

LOCAL_UID=${LOCAL_UID:-}
LOCAL_GID=${LOCAL_GID:-}

if [ -n "$LOCAL_GID" ]; then
  if ! getent group "$LOCAL_GID" >/dev/null 2>&1; then
    groupadd -g "$LOCAL_GID" hostgroup || true
  fi
fi

if [ -n "$LOCAL_UID" ] && [ "$LOCAL_UID" != "0" ]; then
  # Create a user 'appuser' with the requested UID/GID if it doesn't already exist
  if ! id -u appuser >/dev/null 2>&1; then
    useradd -u "$LOCAL_UID" -g "${LOCAL_GID:-$LOCAL_UID}" -m -s /bin/sh appuser || true
  fi

  # Ensure runtime directories exist and are writable
  mkdir -p /work /work/intermediate_files /work/jasen_out /work/logs || true
  chown -R "$LOCAL_UID":"${LOCAL_GID:-$LOCAL_UID}" /work || true

  # Execute the command as the created user
  exec su -s /bin/sh appuser -c "$*"
else
  # No special UID requested — run the command as root
  exec "$@"
fi
