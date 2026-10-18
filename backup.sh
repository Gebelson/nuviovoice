#!/usr/bin/env bash
# Dispara um snapshot manual do banco SQLite dentro do contêiner Concord em execução.
set -euo pipefail
cd "$(dirname "$0")"

if ! docker ps --format '{{.Names}}' | grep -q '^concord$'; then
  echo "Erro: o contêiner concord não está em execução." >&2
  exit 1
fi

docker exec -w /app/packages/server concord \
  node --import tsx/esm src/scripts/snapshot.ts
