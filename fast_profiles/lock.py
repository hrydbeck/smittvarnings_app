"""lock.py

Simple directory-based lock helper for `fast_profiles` operations.

Usage:
    from fast_profiles.lock import acquire_lock, release_lock
    acquire_lock(ref_dir, timeout=30, ttl=3600, force=False)
    try:
        # protected work
    finally:
        release_lock(ref_dir)

The lock is implemented as an atomic mkdir of `<ref_dir>/.lock`. An
owner.json file is written with pid and timestamp. If a lock directory
already exists and is older than `ttl` seconds, it can be removed when
`force=True`.
"""
from __future__ import annotations
import json
import os
import time
import errno

def _lock_dir(ref_dir: str) -> str:
    return os.path.join(ref_dir, '.lock')


def acquire_lock(ref_dir: str, timeout: int = 30, ttl: int = 3600, force: bool = False) -> bool:
    """Try to acquire lock for up to `timeout` seconds. Return True if acquired."""
    ld = _lock_dir(ref_dir)
    start = time.time()
    while True:
        try:
            os.mkdir(ld)
            owner = {'pid': os.getpid(), 'ts': time.time()}
            with open(os.path.join(ld, 'owner.json'), 'w') as fh:
                json.dump(owner, fh)
            return True
        except OSError as e:
            if e.errno != errno.EEXIST:
                raise
            # lock exists
            try:
                st = os.stat(ld)
                age = time.time() - st.st_mtime
                if age > ttl and force:
                    # remove stale lock and retry
                    try:
                        for fn in os.listdir(ld):
                            os.remove(os.path.join(ld, fn))
                        os.rmdir(ld)
                        # loop to try again
                        continue
                    except Exception:
                        pass
            except FileNotFoundError:
                # race, try again
                continue
            if time.time() - start > timeout:
                return False
            time.sleep(0.2)


def release_lock(ref_dir: str) -> None:
    ld = _lock_dir(ref_dir)
    try:
        # remove owner file and lock dir
        ownerf = os.path.join(ld, 'owner.json')
        if os.path.exists(ownerf):
            os.remove(ownerf)
        if os.path.exists(ld):
            os.rmdir(ld)
    except Exception:
        # don't raise on cleanup failure
        pass
