#!/bin/sh
# Bundelt ein tools/*.ts-Skript und fuehrt es in Node aus.
set -e
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ESB="$ROOT/node_modules/.pnpm/esbuild@0.21.5/node_modules/esbuild/bin/esbuild"
SRC="$1"
OUT="$(dirname "$0")/.out.mjs"
node "$ESB" "$SRC" --bundle --platform=node --format=esm --outfile="$OUT" --log-level=warning
shift
node "$OUT" "$@"
