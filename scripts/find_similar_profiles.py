#!/usr/bin/env python3
"""
find_similar_profiles.py

Simple utility to scan a cgMLST allele profile TSV and report pairs of samples
that differ by no more than a configurable number of allelic differences.

Behavior / assumptions:
- Expects a tab-separated values file with a header row. The first column is
  the sample identifier and remaining columns are allele calls (strings or
  integers). Missing alleles are represented as "0" or empty string.
- By default the script will IGNORE loci where either sample has a missing
  allele when counting differences. (This can be changed with --count-missing).
- Outputs TSV with columns: sampleA, sampleB, diffs, compared_loci, pct_diff

Usage:
    python3 scripts/find_similar_profiles.py profiles.tsv --threshold 10

This is intentionally dependency-free (std lib only) so it is easy to plug
into existing watchers/evaluators.
"""
from __future__ import annotations
import argparse
import csv
import sys
from itertools import combinations
from typing import List, Tuple


def read_profiles(path: str) -> Tuple[List[str], List[List[str]]]:
    with open(path, newline="") as fh:
        reader = csv.reader(fh, delimiter="\t")
        header = next(reader)
        ids = []
        rows = []
        for r in reader:
            if not r:
                continue
            ids.append(r[0])
            # pad row if some lines end early
            loci = r[1:]
            rows.append([x.strip() for x in loci])
    return ids, rows


def pair_distance(a: List[str], b: List[str], count_missing_as_diff: bool = False) -> Tuple[int,int]:
    # Compare element-wise; return (diffs, compared_loci)
    L = min(len(a), len(b))
    diffs = 0
    compared = 0
    for i in range(L):
        ai = a[i]
        bi = b[i]
        missing_a = (ai == "" or ai == "0")
        missing_b = (bi == "" or bi == "0")
        if missing_a or missing_b:
            if count_missing_as_diff:
                compared += 1
                # consider them different unless both missing
                if not (missing_a and missing_b):
                    diffs += 1
            else:
                # skip this locus
                continue
        else:
            compared += 1
            if ai != bi:
                diffs += 1
    return diffs, compared


def main() -> int:
    p = argparse.ArgumentParser(description="Find similar samples by direct allele comparison")
    p.add_argument("profiles", help="TSV file with sample in first column and allele calls in the remaining columns")
    p.add_argument("--threshold", type=int, default=10, help="max allele differences to report (inclusive)")
    p.add_argument("--count-missing", action="store_true", help="treat missing alleles (0 or empty) as differences")
    p.add_argument("--min-shared", type=int, default=1, help="minimum number of shared compared loci to consider a pair")
    p.add_argument("--out", help="output TSV path (default stdout)")
    args = p.parse_args()

    ids, rows = read_profiles(args.profiles)
    if not ids:
        print("No profiles found in", args.profiles, file=sys.stderr)
        return 2

    out_f = open(args.out, "w") if args.out else sys.stdout
    writer = csv.writer(out_f, delimiter="\t", lineterminator="\n")
    writer.writerow(["sampleA", "sampleB", "diffs", "compared_loci", "pct_diff"])

    n = len(ids)
    for i, j in combinations(range(n), 2):
        a_id, b_id = ids[i], ids[j]
        a_row, b_row = rows[i], rows[j]
        diffs, compared = pair_distance(a_row, b_row, count_missing_as_diff=args.count_missing)
        if compared < args.min_shared:
            continue
        pct = (diffs / compared * 100.0) if compared else 0.0
        if diffs <= args.threshold:
            writer.writerow([a_id, b_id, str(diffs), str(compared), f"{pct:.2f}"])

    if args.out:
        out_f.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
