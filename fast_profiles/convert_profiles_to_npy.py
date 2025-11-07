#!/usr/bin/env python3
"""
convert_profiles_to_npy.py

Convert a cgMLST profile TSV into a compact numpy array + index for fast
vectorized comparisons. The output is a `.npy` file and an `index.json` that
contains the sample->row mapping, loci order and allele-to-int mappings per
locus.

Usage:
  python3 fast_profiles/convert_profiles_to_npy.py test/sim_profiles.tsv --out-dir fast_profiles/ref

Output files created in out-dir:
  profiles.npy           -- uint16 matrix shape (N, L)
  profiles_index.json    -- JSON with metadata and mappings

This is a simple, dependency-light converter for moderate datasets. For very
large allele vocabularies you may need dtype uint32 instead of uint16.
"""
from __future__ import annotations
import argparse
import csv
import json
import os
from typing import List, Dict

import numpy as np


def read_tsv(path: str) -> (List[str], List[List[str]], List[str]):
    with open(path, newline="") as fh:
        r = csv.reader(fh, delimiter="\t")
        header = next(r)
        loci = header[1:]
        ids = []
        rows = []
        for row in r:
            if not row:
                continue
            ids.append(row[0])
            rows.append([x.strip() for x in row[1:]])
    return ids, rows, loci


def build_mappings(rows: List[List[str]]) -> List[Dict[str,int]]:
    # Build mapping per locus: allele_string -> small int. 0 reserved for missing.
    L = max(len(r) for r in rows) if rows else 0
    mappings: List[Dict[str,int]] = [dict() for _ in range(L)]
    # start mapping at 1, reserve 0 for missing
    for r in rows:
        for i, allele in enumerate(r):
            if allele == '' or allele == '0':
                continue
            mp = mappings[i]
            if allele not in mp:
                mp[allele] = len(mp) + 1
    return mappings


def convert_to_array(rows: List[List[str]], mappings: List[Dict[str,int]], dtype=np.uint16) -> np.ndarray:
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
    p.add_argument("profiles_tsv")
    p.add_argument("--out-dir", default="fast_profiles/ref", help="output directory")
    p.add_argument("--dtype", choices=("uint16","uint32"), default="uint16")
    args = p.parse_args()

    ids, rows, loci = read_tsv(args.profiles_tsv)
    if not ids:
        print("No profiles found", args.profiles_tsv)
        return 2

    mappings = build_mappings(rows)
    dtype = np.uint16 if args.dtype == "uint16" else np.uint32
    arr = convert_to_array(rows, mappings, dtype=dtype)

    os.makedirs(args.out_dir, exist_ok=True)
    out_npy = os.path.join(args.out_dir, "profiles.npy")
    out_index = os.path.join(args.out_dir, "profiles_index.json")

    # Save numpy array (as .npy) -- for large datasets you might switch to memmap
    np.save(out_npy, arr)

    # Save index with sample->row and mappings (mappings become allele->int)
    index = {
        "samples": ids,
        "loci": loci,
        "dtype": str(arr.dtype),
        "shape": list(arr.shape),
        "mappings": [{k:v for k,v in mp.items()} for mp in mappings]
    }
    with open(out_index, "w") as fh:
        json.dump(index, fh)

    print(f"Wrote {out_npy} ({arr.shape}, {arr.dtype}) and {out_index}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
