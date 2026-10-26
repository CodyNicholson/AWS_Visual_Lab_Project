#!/usr/bin/env bash
# Runs the Python sample tests inside a Python container (no local Python setup needed).
set -euo pipefail
cd "$(dirname "$0")/.."
exec docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp/home -e PYTHONDONTWRITEBYTECODE=1 \
  -v "$PWD/samples":/work:ro -v aws-dev-kb-pip-cache:/tmp/pip -w /work python:3.13-slim \
  sh -c 'python -m venv /tmp/venv && /tmp/venv/bin/pip install -q --cache-dir /tmp/pip -r requirements-dev.txt && /tmp/venv/bin/python -m pytest -p no:cacheprovider "$@"' -- "$@"
