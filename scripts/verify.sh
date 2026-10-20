#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm ts-check
pnpm lint