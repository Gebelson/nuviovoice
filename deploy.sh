#!/bin/bash
# ============================================================
# Concord — Script de Implantação Rápida (Oracle Cloud / VPS)
# ============================================================
# Sincroniza o código e compila a instância no servidor remoto.
#
# Uso:
#   ./deploy.sh <usuario@ip-ou-dominio>
# ============================================================

set -euo pipefail
cd "$(dirname "$0")"

BUILD_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo '')"

REMOTE_TARGET="${1:-}"

if [[ -z "$REMOTE_TARGET" ]]; then
  echo "Uso: ./deploy.sh usuario@host-ou-ip"
  echo "Exemplo: ./deploy.sh ubuntu@129.148.x.x"
  exit 1
fi

REMOTE_PATH="~/concord"

EXCLUDES=(
  --exclude='node_modules'
  --exclude='.git'
  --exclude='.env'
  --exclude='.env.local'
  --exclude='packages/*/node_modules'
  --exclude='packages/web/dist'
  --exclude='packages/desktop'
  --exclude='data'
  --exclude='livekit.yaml'
  --exclude='Caddyfile'
)

echo "==> Sincronizando arquivos com $REMOTE_TARGET:$REMOTE_PATH..."
ssh "$REMOTE_TARGET" "mkdir -p $REMOTE_PATH"
rsync -avz --delete "${EXCLUDES[@]}" ./ "$REMOTE_TARGET:$REMOTE_PATH/"

echo "==> Reconstruindo e reiniciando contêineres Concord..."
ssh -t "$REMOTE_TARGET" "
  cd $REMOTE_PATH
  export CONCORD_COMMIT='$BUILD_COMMIT'
  docker compose build concord
  docker compose up -d concord
  echo '==> Concord atualizado com sucesso!'
"
