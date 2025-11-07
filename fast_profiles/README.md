# fast_profiles

Small standalone utility to convert cgMLST profile TSVs into a compact numpy
matrix and perform fast comparisons of new samples against the reference.

Files:

- `convert_profiles_to_npy.py` - converter that outputs `profiles.npy` and `profiles_index.json`.
- `compare_new_to_ref.py` - comparator that loads the numpy array (mmap) and
  checks new samples in blocks.

Usage example:

```bash
python3 fast_profiles/convert_profiles_to_npy.py test/sim_profiles.tsv --out-dir fast_profiles/ref
python3 fast_profiles/compare_new_to_ref.py --ref-dir fast_profiles/ref --new test/sim_profiles.tsv --threshold 10
```

Notes:

- This is intended to be used as an independent project/branch replacement for
  the ReporTree step in experimental workflows. It is low-dependency (numpy)
  and safe to integrate into watchers.
