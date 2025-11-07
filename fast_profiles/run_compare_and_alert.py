#!/usr/bin/env python3
"""
run_compare_and_alert.py

Wrapper that runs `compare_new_to_ref.py` for a given new profiles TSV against a
reference produced by `convert_profiles_to_npy.py`. If matches under threshold
are found, the script writes an alerts TSV into `alerts_dir` and optionally
sends a short email summary if SMTP environment variables are provided.

Environment variables for SMTP (optional):
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_TO

Usage example:
  python3 fast_profiles/run_compare_and_alert.py --ref-dir fast_profiles/ref --new test/sim_profiles.tsv --threshold 1

This script purposely has no external dependencies beyond the Python stdlib
and numpy (used by compare_new_to_ref.py).
"""
from __future__ import annotations
import argparse
import os
import subprocess
import sys
import datetime
import smtplib
from email.message import EmailMessage


def send_email(subject: str, body: str, to_addr: str) -> None:
    host = os.environ.get("SMTP_HOST")
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER")
    pwd = os.environ.get("SMTP_PASS")
    if not host or not to_addr:
        print("SMTP not configured (SMTP_HOST or ALERT_TO missing); skipping email")
        return
    msg = EmailMessage()
    msg.set_content(body)
    msg["Subject"] = subject
    msg["From"] = user or f"noreply@example.com"
    msg["To"] = to_addr
    try:
        with smtplib.SMTP(host, port, timeout=10) as s:
            s.starttls()
            if user and pwd:
                s.login(user, pwd)
            s.send_message(msg)
        print("Email sent to", to_addr)
    except Exception as e:
        print("Failed to send email:", e)


def notify_desktop(summary: str) -> None:
    # Use notify-send if available (Linux)
    try:
        subprocess.run(["notify-send", "smittvarnings alert", summary], check=False)
    except FileNotFoundError:
        pass


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--ref-dir", required=True)
    p.add_argument("--new", required=True)
    p.add_argument("--threshold", type=int, default=10)
    p.add_argument("--out-dir", default="fast_profiles/alerts")
    p.add_argument("--block-size", type=int, default=10000)
    args = p.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)

    cmd = [sys.executable, os.path.join(os.path.dirname(__file__), "compare_new_to_ref.py"),
           "--ref-dir", args.ref_dir,
           "--new", args.new,
           "--threshold", str(args.threshold),
           "--block-size", str(args.block_size)]

    print("Running comparator:", " ".join(cmd))
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print("Comparator failed:", proc.stderr)
        return proc.returncode

    out = proc.stdout.strip().splitlines()
    if not out:
        print("No matches found")
        return 0

    # skip header if present
    if out and out[0].startswith("sampleA"):
        out = out[1:]

    if not out:
        print("No matches after header")
        return 0

    ts = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    out_path = os.path.join(args.out_dir, f"matches_{ts}.tsv")
    with open(out_path, "w") as fh:
        fh.write("sampleA\tsampleB\tdiffs\tcompared_loci\tpct_diff\n")
        for line in out:
            fh.write(line.rstrip() + "\n")

    summary = f"Found {len(out)} matches (threshold={args.threshold}). Saved to {out_path}"
    print(summary)

    # send email if ALERT_TO set
    alert_to = os.environ.get("ALERT_TO")
    if alert_to:
        body = f"smittvarnings: {summary}\n\nTop matches:\n" + "\n".join(out[:20])
        send_email("smittvarnings alert: matches found", body, alert_to)

    # desktop notify
    notify_desktop(summary)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
