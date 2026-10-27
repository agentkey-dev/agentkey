"""Check secret-scanning rules using disposable, never-enrolled TOTP seeds."""

import base64
import os
from pathlib import Path
import secrets
import subprocess


ROOT = Path(__file__).resolve().parents[1]
SCANNER = os.environ.get("GITLEAKS_BIN", "gitleaks")
seed = base64.b32encode(secrets.token_bytes(10)).decode().rstrip("=")
cases = {
    "assignment": (f'const rawSeed = "{seed}";', 1),
    "URI": (f"otpauth://totp/Test?secret={seed}&issuer=Test", 1),
    "instructions": (f"secret key for TOTP : {seed.lower()}", 1),
    "helper argument": (f'parseTotpSecretInput("{seed.lower()}")', 1),
    "public example": ('const rawSeed = "JBSWY3DPEHPK3PXP";', 0),
    "public RFC vector": (
        'const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";', 0
    ),
}

for name, (content, expected) in cases.items():
    result = subprocess.run(
        [SCANNER, "stdin", "--config", str(ROOT / ".gitleaks.toml"),
         "--redact", "--no-banner"],
        input=content, text=True, capture_output=True, check=False,
    )
    if result.returncode != expected:
        raise SystemExit(f"Secret scanner regression: {name}")
    print(f"PASS: {name}")
