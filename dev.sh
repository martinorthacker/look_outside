#!/bin/sh
# Führt einen Befehl im Node-Container aus, mit exakt der Node-Version aus
# .node-version, die auch der Workflow (setup-node: node-version-file) nutzt.
# Arbeitsverzeichnis im Container: scraper/
#   ./dev.sh npm ci
#   ./dev.sh npm test
#   ./dev.sh node sources/geosphere.js
set -eu
cd "$(dirname "$0")"
TTY=""; [ -t 0 ] && [ -t 1 ] && TTY="-t"
exec docker run --rm -i $TTY \
  -u "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD":/app -w /app/scraper \
  "node:$(cat .node-version)-trixie-slim" "$@"
