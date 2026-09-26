"""Runs every test script in this folder and summarises OK / FAIL lines.

Build the app first:  python tools/build.py --no-zip
Then:                 python tests/run_all.py
Requires Playwright:  pip install playwright && python -m playwright install chromium
"""
import subprocess, sys
from pathlib import Path

here = Path(__file__).resolve().parent
failed = total = 0
for t in sorted(here.glob("*.py")):
    if t.name == "run_all.py":
        continue
    out = subprocess.run([sys.executable, str(t)], capture_output=True, text=True, encoding="utf-8")
    lines = out.stdout.splitlines()
    oks = sum(l.startswith("OK") for l in lines)
    fails = [l for l in lines if l.startswith("FAIL")]
    js_errors = [l for l in lines if l.startswith("BŁĘDY JS") and not l.rstrip().endswith("[]")]
    total += oks + len(fails)
    failed += len(fails) + len(js_errors) + (out.returncode != 0)
    status = "ok" if not fails and not js_errors and out.returncode == 0 else "FAIL"
    print(f"{status:4}  {t.name:10} {oks} passed, {len(fails)} failed")
    for l in fails + js_errors:
        print("      " + l)
    if out.returncode != 0:
        print("      " + (out.stderr.strip().splitlines() or ["(crashed)"])[-1])
print(f"\n{total} checks, {failed} problem(s)")
sys.exit(1 if failed else 0)
