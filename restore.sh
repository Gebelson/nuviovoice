#!/usr/bin/env bash
# Restaura o banco de dados SQLite do Concord a partir de um snapshot em data/backups/.
# Uso:
#   ./restore.sh                 Lista os snapshots disponíveis.
#   ./restore.sh <snapshot.db>   Restaura o snapshot especificado (caminho ou nome do arquivo).
set -euo pipefail
cd "$(dirname "$0")"

BACKUP_DIR="data/backups"
DB="data/concord.db"

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "Diretório de backups não encontrado em $BACKUP_DIR." >&2
  exit 1
fi

# Sem argumentos: listar snapshots do mais recente para o mais antigo e sair.
if [[ $# -eq 0 ]]; then
  shopt -s nullglob
  snaps=("$BACKUP_DIR"/*.db)
  shopt -u nullglob
  if [[ ${#snaps[@]} -eq 0 ]]; then
    echo "Nenhum snapshot encontrado em $BACKUP_DIR."
    exit 0
  fi
  echo "Snapshots disponíveis (mais recente primeiro):"
  for f in $(ls -1t "$BACKUP_DIR"/*.db); do
    printf "  %s  (%s)\n" "$(basename "$f")" "$(du -h "$f" | cut -f1)"
  done
  echo ""
  echo "Para restaurar, execute: ./restore.sh <nome-do-arquivo.db>"
  exit 0
fi

SNAP_NAME="$(basename "$1")"
if [[ ! -f "$BACKUP_DIR/$SNAP_NAME" ]]; then
  echo "Snapshot não encontrado em $BACKUP_DIR: $SNAP_NAME" >&2
  exit 1
fi

echo "Prestess a restaurar: $BACKUP_DIR/$SNAP_NAME"
echo "Isso SUBSTITUIRÁ $DB. O banco atual será salvo como um snapshot pré-restauração."
read -rp "Continuar? [s/N] " yn
[[ "${yn,,}" == "s" || "${yn,,}" == "y" ]] || { echo "Operação cancelada."; exit 0; }

echo "[1/3] Parando contêiner concord..."
docker compose stop concord

TS="$(date -u +%Y%m%dT%H%M%S)"
echo "[2/3] Substituindo banco de dados (cópia de segurança + limpeza de WAL + instalação)..."
docker run --rm -v "$(pwd)/data:/data" alpine sh -c '
  set -e
  if [ -f /data/concord.db ]; then
    cp /data/concord.db "/data/backups/concord-$1-pre-restore.db"
  fi
  rm -f /data/concord.db-wal /data/concord.db-shm
  cp "/data/backups/$2" /data/concord.db
' sh "$TS" "$SNAP_NAME"

echo "[3/3] Iniciando contêiner concord..."
docker compose start concord
echo "Concluído. Para acompanhar os logs: docker compose logs -f concord"
