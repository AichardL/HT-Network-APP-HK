#!/bin/bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_DIR"

# HTTP 服务端口固定 5000（可用 DEPLOY_RUN_PORT 覆盖以支持多实例/测试）。
PORT="${DEPLOY_RUN_PORT:-5000}"

echo "Starting HTTP service on port ${PORT} for deploy..."
pnpm exec next start --port "${PORT}"

echo "Service started."