#!/usr/bin/env bash
# Runs a command inside the Node toolchain container (no local Node install needed).
# Usage: scripts/npm.sh npm install | scripts/npm.sh npm run build
set -euo pipefail
cd "$(dirname "$0")/.."
exec docker run --rm -i -u "$(id -u):$(id -g)" -e HOME=/tmp/home -e npm_config_cache=/tmp/npm-cache \
  -v "$PWD":/work -v aws-dev-kb-npm-cache:/tmp/npm-cache -w /work ${DOCKER_ARGS:-} node:24-alpine "$@"
