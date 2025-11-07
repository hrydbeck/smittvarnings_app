#!/usr/bin/env python3
"""
rebuild_profiles.py

Rebuild the reference `profiles.npy` and `profiles_index.json` from one or more
input TSV files. This is used when new allele values appear or when you want to
age-out old samples and create a fresh reference.

Usage:
  python3 fast_profiles/rebuild_profiles.py --inputs dir_with_tsvs --out-dir fast_profiles/ref

The `--inputs` argument can be a directory (will glob for `*.tsv`) or one or
more explicit TSV file paths separated by spaces.
"""
from __future__ import annotations
import argparse
import csv
import glob
import json
import os
from typing import List

import numpy as np
from fast_profiles.lock import acquire_lock, release_lock


def collect_inputs(inputs_arg: List[str]) -> List[str]:
    files = []
    for p in inputs_arg:
        if os.path.isdir(p):
            files.extend(sorted(glob.glob(os.path.join(p, "*.tsv"))))
        elif os.path.exists(p):
            files.append(p)
        else:
            # allow glob patterns
            files.extend(sorted(glob.glob(p)))
    return files


def read_all(files: List[str]):
    ids = []
    rows = []
    loci = None
    for f in files:
        with open(f, newline="") as fh:
            r = csv.reader(fh, delimiter="\t")
            header = next(r)
            if loci is None:
                loci = header[1:]
            for row in r:
                if not row:
                    continue
                ids.append(row[0])
                rows.append([x.strip() for x in row[1:]])
    return ids, rows, (loci or [])


def build_mappings(rows: List[List[str]]) -> List[dict]:
    L = max(len(r) for r in rows) if rows else 0
    mappings = [dict() for _ in range(L)]
    for r in rows:
        for i, allele in enumerate(r):
            if allele == '' or allele == '0':
                continue
            mp = mappings[i]
            if allele not in mp:
                mp[allele] = len(mp) + 1
    return mappings


def convert_to_array(rows: List[List[str]], mappings: List[dict], dtype=np.uint16):
    N = len(rows)
    L = len(mappings)
    arr = np.zeros((N, L), dtype=dtype)
    for i, r in enumerate(rows):
        for j in range(L):
            allele = r[j] if j < len(r) else ''
            if allele == '' or allele == '0':
                val = 0
            else:
                val = mappings[j].get(allele, 0)
            arr[i, j] = val
    return arr


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--inputs", nargs='+', required=True, help="TSV files or directories to read")
    p.add_argument("--out-dir", required=True)
    p.add_argument("--dtype", choices=("uint16","uint32"), default="uint16")
    args = p.parse_args()

    files = collect_inputs(args.inputs)
    if not files:
        print("No input TSV files found")
        return 2

    ids, rows, loci = read_all(files)
    if not ids:
        print("No profiles read from inputs")
        return 2

    mappings = build_mappings(rows)
    dtype = np.uint16 if args.dtype == "uint16" else np.uint32
    arr = convert_to_array(rows, mappings, dtype=dtype)

    os.makedirs(args.out_dir, exist_ok=True)
    out_npy = os.path.join(args.out_dir, "profiles.npy")
    out_index = os.path.join(args.out_dir, "profiles_index.json")

    # acquire exclusive lock while rebuilding
    if not acquire_lock(args.out_dir, timeout=int(os.environ.get('REF_LOCK_TIMEOUT', '30')), ttl=int(os.environ.get('REF_LOCK_TTL', '3600')), force=False):
        print('Could not acquire lock on', args.out_dir)
        return 4

    try:
        np.save(out_npy, arr)
        index = {
            "samples": ids,
            "loci": loci,
            "dtype": str(arr.dtype),
            "shape": list(arr.shape),
            "mappings": [{k:v for k,v in mp.items()} for mp in mappings]
        }
        with open(out_index, "w") as fh:
            json.dump(index, fh)

        print(f"Rebuilt reference with {len(ids)} samples -> {out_npy}")
        return 0
    finally:
        try:
            release_lock(args.out_dir)
        except Exception:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
