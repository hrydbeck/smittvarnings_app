#!/usr/bin/env python3
"""
compare_new_to_ref.py

Compare new cgMLST profiles against a reference numpy matrix created by
`convert_profiles_to_npy.py` and report matches within a threshold number of
allelic differences.

This script loads the reference via `numpy.load(..., mmap_mode='r')` so it can
handle references larger than RAM by comparing in blocks.

Usage:
  python3 fast_profiles/compare_new_to_ref.py --ref-dir fast_profiles/ref --new test/sim_profiles.tsv --threshold 10
"""
from __future__ import annotations
import argparse
import csv
import json
import os
from typing import List

import numpy as np
from fast_profiles.lock import acquire_lock, release_lock


def read_tsv_rows(path: str) -> (List[str], List[List[str]]):
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


def new_row_to_ints(row: List[str], mappings: List[dict]) -> List[int]:
    L = len(mappings)
    out = [0] * L
    for i in range(L):
        allele = row[i] if i < len(row) else ''
        if allele == '' or allele == '0':
            out[i] = 0
        else:
            out[i] = mappings[i].get(allele, 0)
    return out


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--ref-dir", required=True, help="directory containing profiles.npy and profiles_index.json")
    p.add_argument("--new", required=True, help="TSV file with new samples (same columns as original)")
    p.add_argument("--threshold", type=int, default=10)
    p.add_argument("--block-size", type=int, default=10000, help="number of ref rows to load per block")
    p.add_argument("--out", help="output TSV (default stdout)")
    args = p.parse_args()

    idx_path = os.path.join(args.ref_dir, "profiles_index.json")
    npy_path = os.path.join(args.ref_dir, "profiles.npy")
    if not os.path.exists(idx_path) or not os.path.exists(npy_path):
        print("Missing ref files in", args.ref_dir)
        return 2

    # acquire lock for read (protects against concurrent append/rebuild)
    if not acquire_lock(args.ref_dir, timeout=int(os.environ.get('REF_LOCK_TIMEOUT', '30')), ttl=int(os.environ.get('REF_LOCK_TTL', '3600')), force=False):
        print('Could not acquire lock on', args.ref_dir)
        return 4

    with open(idx_path) as fh:
        index = json.load(fh)
    mappings = index.get("mappings", [])
    samples_ref = index.get("samples", [])

    arr_ref = np.load(npy_path, mmap_mode='r')
    n_ref, n_loci = arr_ref.shape

    new_ids, new_rows = read_tsv_rows(args.new)
    if not new_ids:
        print("No new samples found")
        return 2

    out_f = open(args.out, "w") if args.out else None
    writer = None
    if out_f:
        import csv
        writer = csv.writer(out_f, delimiter="\t", lineterminator="\n")
        writer.writerow(["sampleA","sampleB","diffs","compared_loci","pct_diff"])
    else:
        print("sampleA\tsampleB\tdiffs\tcompared_loci\tpct_diff")

    # For each new row, convert and compare to ref in blocks
    for new_id, new_row in zip(new_ids, new_rows):
        new_ints = np.array(new_row_to_ints(new_row, mappings), dtype=arr_ref.dtype)
        # process ref in blocks
        for start in range(0, n_ref, args.block_size):
            end = min(n_ref, start + args.block_size)
            block = arr_ref[start:end]
            # compute diffs: count non-equal positions, but ignore positions where both are 0
            neq = (block != new_ints)
            # when both are zero (missing), we want to ignore that locus from compared count
            both_zero = (block == 0) & (new_ints == 0)
            # set neq to False where both zero
            neq[both_zero] = False
            diffs = neq.sum(axis=1)
            compared = (~both_zero).sum(axis=1)
            # report matches within threshold and where compared > 0
            for i_rel, d in enumerate(diffs.tolist()):
                comp = int(compared[i_rel])
                if comp == 0:
                    continue
                if d <= args.threshold:
                    ref_idx = start + i_rel
                    ref_id = samples_ref[ref_idx]
                    pct = (d / comp * 100.0)
                    if writer:
                        writer.writerow([new_id, ref_id, int(d), comp, f"{pct:.2f}"])
                    else:
                        print(f"{new_id}\t{ref_id}\t{int(d)}\t{comp}\t{pct:.2f}")

    if out_f:
        out_f.close()
    # release lock
    try:
        release_lock(args.ref_dir)
    except Exception:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
