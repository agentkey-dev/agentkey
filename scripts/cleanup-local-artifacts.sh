#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

rm -rf \
  "$ROOT_DIR/app/.next" \
  "$ROOT_DIR/app/.open-next" \
  "$ROOT_DIR/app/.wrangler"

find "$ROOT_DIR" -type f \( \
  -name "wrangler-*.log" -o \
  -name ".wrangler-*.log" \
\) -delete

printf '%s\n' "Removed local Next/OpenNext/Wrangler artifacts."
