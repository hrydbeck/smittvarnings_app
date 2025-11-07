#!/usr/bin/env python3
"""
append_profiles_to_npy.py

Append new profiles (TSV) to an existing `profiles.npy` produced by
`convert_profiles_to_npy.py` without changing existing allele mappings.

If the new samples contain allele values that are not present in the stored
mappings, the script will abort and request a rebuild (see `rebuild_profiles.py`).

This script writes a new temporary `.npy` and atomically replaces the old
file to avoid corrupting the reference in case of failure.
"""
from __future__ import annotations
import argparse
import csv
import json
import os
import shutil
import tempfile
from typing import List

import numpy as np
import os, sys
# ensure project root is on sys.path so 'fast_profiles' package is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from fast_profiles.lock import acquire_lock, release_lock


def read_new_rows(path: str):
    with open(path, newline="") as fh:
        r = csv.reader(fh, delimiter="\t")
        header = next(r)
        ids = []
        rows = []
        for row in r:
            if not row:
                continue
            ids.append(row[0])
            rows.append([x.strip() for x in row[1:]])
    return ids, rows


def new_row_to_ints(row: List[str], mappings: List[dict], L: int, dtype) -> List[int]:
    out = [0] * L
    missing = False
    for i in range(L):
        allele = row[i] if i < len(row) else ''
        if allele == '' or allele == '0':
            out[i] = 0
        else:
            val = mappings[i].get(allele)
            if val is None:
                missing = True
                out[i] = 0
            else:
                out[i] = val
    return out, missing


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--ref-dir", required=True)
    p.add_argument("--new", required=True)
    args = p.parse_args()

    idx_path = os.path.join(args.ref_dir, "profiles_index.json")
    npy_path = os.path.join(args.ref_dir, "profiles.npy")
    if not os.path.exists(idx_path) or not os.path.exists(npy_path):
        print("Missing reference files in", args.ref_dir)
        return 2

    # acquire exclusive lock before modifying reference
    if not acquire_lock(args.ref_dir, timeout=int(os.environ.get('REF_LOCK_TIMEOUT', '30')), ttl=int(os.environ.get('REF_LOCK_TTL', '3600')), force=False):
        print('Could not acquire lock on', args.ref_dir)
        return 4

    with open(idx_path) as fh:
        index = json.load(fh)
    mappings = index.get("mappings", [])
    samples_ref = index.get("samples", [])
    dtype = np.dtype(index.get("dtype", "uint16"))

    arr_ref = np.load(npy_path, mmap_mode='r')
    n_ref, n_loci = arr_ref.shape

    new_ids, new_rows = read_new_rows(args.new)
    if not new_ids:
        print("No new samples found")
        return 2

    # convert new rows using existing mappings; abort if unseen alleles found
    new_ints_list = []
    found_missing = False
    for row in new_rows:
        ints, missing = new_row_to_ints(row, mappings, n_loci, dtype)
        if missing:
            found_missing = True
        new_ints_list.append(ints)

    if found_missing:
        print("One or more new alleles were not present in the reference mappings.")
        print("You must run the rebuild tool to recreate the reference with union of alleles:")
        print("  python3 fast_profiles/rebuild_profiles.py --out-dir ", args.ref_dir)
        return 3

    n_new = len(new_ints_list)
    # create a new memmap file and copy old+new into it
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".npy", dir=args.ref_dir)
    os.close(tmp_fd)
    try:
        new_shape = (n_ref + n_new, n_loci)
        mm = np.lib.format.open_memmap(tmp_path, mode='w+', dtype=dtype, shape=new_shape)
        # copy in blocks to avoid memory spikes
        block = 10000
        for start in range(0, n_ref, block):
            end = min(n_ref, start + block)
            mm[start:end] = arr_ref[start:end]
        # append new rows
        for i, ints in enumerate(new_ints_list):
            mm[n_ref + i, :] = np.array(ints, dtype=dtype)

        # write new index
        new_samples = samples_ref + new_ids
        index["samples"] = new_samples
        index["shape"] = [new_shape[0], new_shape[1]]

        # atomically replace files
        backup = npy_path + ".bak"
        os.replace(tmp_path, npy_path)
        with open(os.path.join(args.ref_dir, "profiles_index.json"), "w") as fh:
            json.dump(index, fh)

        print(f"Appended {n_new} samples to {npy_path}")
        return 0
    finally:
        # release lock and cleanup
        try:
            release_lock(args.ref_dir)
        except Exception:
            pass
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass


if __name__ == "__main__":
    raise SystemExit(main())
