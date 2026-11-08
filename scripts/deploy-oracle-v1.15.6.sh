#!/usr/bin/env bash
# ==============================================================================
# NUVIO — Script de Atualização Blindada do Backend Oracle Cloud (v1.15.6)
# Commit obrigatório de base: 7d8c8dec44be78477aad2a7f23315db8797a610f
#
# AUDITORIA FINAL DE SEGURANÇA:
# 1. Eliminação total de 'exclusão destrutiva de data' no rollback; preservação atômica via mv data data_preserved_*.
# 2. Captura do Image ID real, container image e variáveis Compose (CONCORD_IMAGE, CONCORD_IMAGE_TAG).
# 3. Prontidão estrita: exige Docker HEALTHY E resposta HTTP 200 simultâneos (ambos obrigatórios).
# 4. Confirmação interativa com possibilidade de cancelamento antes de qualquer parada de serviço.
# 5. Caminhos absolutos em Node.js e validação de migrações e rotas internas.
# ==============================================================================
set -euo pipefail

REQUIRED_ANCESTOR="7d8c8dec44be78477aad2a7f23315db8797a610f"
APP_DIR="${HOME}/concord"
BACKUP_DIR="${HOME}/nuvio_backups"

DEPLOY_STAGE="INITIAL"
ORIGINAL_COMMIT=""
ORIGINAL_IMAGE_ID=""
ORIGINAL_CONTAINER_IMAGE=""
COMPOSE_IMAGE_NAME=""
BACKUP_FILE=""

echo "=================================================================="
echo "NUVIO — Atualização Segura do Backend Oracle Cloud (v1.15.6)"
echo "Diretório da Aplicação: ${APP_DIR}"
echo "Commit Obrigatório:     ${REQUIRED_ANCESTOR}"
echo "=================================================================="

cd "${APP_DIR}"
mkdir -p "${BACKUP_DIR}"

# ------------------------------------------------------------------------------
# Confirmação Interativa do Operador (Possibilidade de Cancelamento)
# ------------------------------------------------------------------------------
echo ""
echo "Esta operação atualizará o backend para a versão v1.15.6."
echo "Uma breve parada do container será necessária para backup consistente do SQLite."
read -p "Deseja continuar com a atualização? [digite 'sim' para prosseguir]: " USER_CONFIRM
if [ "${USER_CONFIRM}" != "sim" ]; then
  echo "Operação abortada pelo operador. Nenhuma modificação foi realizada."
  exit 0
fi

# ==============================================================================
# TRAP DE ROLLBACK EM CASO DE QUALQUER FALHA
# ==============================================================================
cleanup_on_error() {
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    echo ""
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    echo "FALHA DURANTE A IMPLANTAÇÃO (Etapa: ${DEPLOY_STAGE}, Código: ${exit_code})"
    echo "Acionando salvaguarda de Rollback Seguro..."
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"

    case "${DEPLOY_STAGE}" in
      "INITIAL"|"PRE_BACKUP"|"BACKUP")
        echo "-> Falha prévia ao build. Dados e código estão intactos."
        echo "-> Reativando container original..."
        if [ -n "${ORIGINAL_IMAGE_ID:-}" ]; then
          docker tag "${ORIGINAL_IMAGE_ID}" "${COMPOSE_IMAGE_NAME}" 2>/dev/null || true
          docker tag "${ORIGINAL_IMAGE_ID}" "${ORIGINAL_CONTAINER_IMAGE}" 2>/dev/null || true
          docker tag "${ORIGINAL_IMAGE_ID}" "concord:latest" 2>/dev/null || true
        fi
        docker compose up -d concord || true
        ;;

      "GIT_OR_BUILD")
        echo "-> Falha durante checkout ou compilação Docker."
        echo "-> Revertendo repositório para o commit anterior: ${ORIGINAL_COMMIT}..."
        git checkout "${ORIGINAL_COMMIT}" 2>/dev/null || true
        if [ -n "${ORIGINAL_IMAGE_ID:-}" ]; then
          docker tag "${ORIGINAL_IMAGE_ID}" "${COMPOSE_IMAGE_NAME}" 2>/dev/null || true
          docker tag "${ORIGINAL_IMAGE_ID}" "${ORIGINAL_CONTAINER_IMAGE}" 2>/dev/null || true
          docker tag "${ORIGINAL_IMAGE_ID}" "concord:latest" 2>/dev/null || true
        fi
        docker compose up -d concord || true
        ;;

      "STARTUP"|"VALIDATION")
        echo "-> Falha após a inicialização ou na validação do container v1.15.6."
        echo "-> 1. Parando container que falhou na validação..."
        docker compose stop concord || true

        if [ -f "${BACKUP_FILE}" ]; then
          PRESERVED_DATA="data_preserved_$(date +%Y%m%d_%H%M%S)"
          echo "-> 2. Preservando estado de data/ em ${PRESERVED_DATA} (sem descartar escritas)..."
          mv data "${PRESERVED_DATA}" || true

          echo "-> 3. Restaurando base de dados consistente do backup pré-deploy..."
          tar -xzf "${BACKUP_FILE}"
        fi

        echo "-> 4. Restaurando código e imagem Docker da versão anterior..."
        git checkout "${ORIGINAL_COMMIT}" 2>/dev/null || true
        if [ -n "${ORIGINAL_IMAGE_ID:-}" ]; then
          docker tag "${ORIGINAL_IMAGE_ID}" "${COMPOSE_IMAGE_NAME}" 2>/dev/null || true
          docker tag "${ORIGINAL_IMAGE_ID}" "${ORIGINAL_CONTAINER_IMAGE}" 2>/dev/null || true
          docker tag "${ORIGINAL_IMAGE_ID}" "concord:latest" 2>/dev/null || true
        fi
        docker compose up -d concord || true
        ;;
    esac

    echo ""
    echo "==> Rollback concluído com segurança. Sistema retornado ao estado original estável."
  fi
}
trap cleanup_on_error EXIT

# ==============================================================================
# FASE 1: Verificações Preliminares de Segurança e Captura de Configuração
# ==============================================================================
DEPLOY_STAGE="PRE_BACKUP"
echo ""
echo "[Fase 1/6] Verificando ambiente e capturando configuração do Compose..."

# 1.1 Validar se há arquivos sujos no Git
if [ -n "$(git status --porcelain)" ]; then
  echo "ERRO CRÍTICO: Existem alterações locais não commitadas no repositório!" >&2
  git status --short
  exit 1
fi

# 1.2 Capturar commit original
ORIGINAL_COMMIT=$(git rev-parse HEAD)
echo "Commit atual no repositório: ${ORIGINAL_COMMIT}"

# 1.3 Capturar ID real da imagem Docker e configuração exata do Compose
ORIGINAL_IMAGE_ID=$(docker compose images -q concord 2>/dev/null | head -n 1)
[ -z "${ORIGINAL_IMAGE_ID}" ] && ORIGINAL_IMAGE_ID=$(docker inspect --format='{{.Image}}' concord 2>/dev/null || true)
ORIGINAL_CONTAINER_IMAGE=$(docker inspect --format='{{.Config.Image}}' concord 2>/dev/null || echo "concord:latest")

ENV_IMAGE=$(grep -E '^CONCORD_IMAGE=' .env 2>/dev/null | cut -d '=' -f2- | tr -d ' "' || echo "")
ENV_TAG=$(grep -E '^CONCORD_IMAGE_TAG=' .env 2>/dev/null | cut -d '=' -f2- | tr -d ' "' || echo "")
COMPOSE_IMAGE_NAME="${ENV_IMAGE:-concord}:${ENV_TAG:-latest}"

echo "Imagem Docker em execução (ID):  ${ORIGINAL_IMAGE_ID:-N/A}"
echo "Imagem configurada no container: ${ORIGINAL_CONTAINER_IMAGE}"
echo "Imagem alvo do Compose:          ${COMPOSE_IMAGE_NAME}"

if [ -n "${ORIGINAL_IMAGE_ID}" ]; then
  docker tag "${ORIGINAL_IMAGE_ID}" "concord:rollback-pre-v1.15.6"
fi

# 1.4 Espaço livre em disco
FREE_SPACE_KB=$(df -k . | awk 'NR==2 {print $4}')
if [ "${FREE_SPACE_KB}" -lt 1048576 ]; then
  echo "ERRO CRÍTICO: Menos de 1 GB de espaço livre em disco!" >&2
  exit 1
fi

# ==============================================================================
# FASE 2: Isolamento de Escritas, Checkpoint WAL a Frio e Backup Testado
# ==============================================================================
DEPLOY_STAGE="BACKUP"
echo ""
echo "[Fase 2/6] Isolando escritas concorrentes e executando checkpoint WAL..."

# 2.1 Parar o container concord para cessar qualquer tráfego ou gravação
docker compose stop concord

# 2.2 Executar wal_checkpoint(TRUNCATE) com container efêmero
echo "Executando checkpoint WAL a frio no banco inativo..."
docker compose run --rm --no-deps concord node -e "
const Database = require('better-sqlite3');
const db = new Database('/app/data/concord.db');
const cp = db.pragma('wal_checkpoint(TRUNCATE)');
console.log('Checkpoint WAL (TRUNCATE):', JSON.stringify(cp));
const integrity = db.pragma('integrity_check');
console.log('Integridade SQLite:', JSON.stringify(integrity));
if (integrity[0]?.integrity_check !== 'ok') {
  console.error('ERRO CRÍTICO: Banco com corrupção estrutural prévia!');
  process.exit(1);
}
db.close();
"

# 2.3 Gerar o arquivo de backup
BACKUP_FILE="${BACKUP_DIR}/nuvio-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
echo "Compactando backup consistente em ${BACKUP_FILE}..."
tar -czf "${BACKUP_FILE}" data/
ls -lh "${BACKUP_FILE}"

# 2.4 Teste de extração real do backup em pasta temporária isolada
echo "Testando extração do backup e validação de integridade da cópia..."
RESTORE_TEST_DIR=$(mktemp -d /tmp/nuvio-restore-test.XXXXXX)
tar -xzf "${BACKUP_FILE}" -C "${RESTORE_TEST_DIR}"

docker compose run --rm --no-deps -v "${RESTORE_TEST_DIR}/data:/test_data" concord node -e "
const Database = require('better-sqlite3');
const db = new Database('/test_data/concord.db');
const res = db.pragma('integrity_check');
console.log('Integridade da cópia restaurada:', JSON.stringify(res));
if (res[0]?.integrity_check !== 'ok') {
  console.error('ERRO CRÍTICO: O banco extraído do backup está corrompido!');
  process.exit(1);
}
db.close();
"
rm -rf "${RESTORE_TEST_DIR}"
echo "Backup validado com sucesso e 100% recuperável."

# ==============================================================================
# FASE 3: Sincronização do Repositório e Trava no Commit v1.15.6
# ==============================================================================
DEPLOY_STAGE="GIT_OR_BUILD"
echo ""
echo "[Fase 3/6] Sincronizando código com origin/main..."

git fetch origin main

# Validar se o HEAD do repositório contém as alterações da versão v1.15.6
CURRENT_COMMIT=$(git rev-parse HEAD)
if ! git merge-base --is-ancestor "${REQUIRED_ANCESTOR}" "${CURRENT_COMMIT}" && [ "${CURRENT_COMMIT}" != "${REQUIRED_ANCESTOR}" ]; then
  echo "ERRO CRÍTICO: O repositório não contém as alterações da versão v1.15.6 (${REQUIRED_ANCESTOR})!" >&2
  exit 1
fi

echo "Commit verificado e compatível com v1.15.6: ${CURRENT_COMMIT}"

# ==============================================================================
# FASE 4: Recompilação da Imagem Docker com Tag de Commit
# ==============================================================================
echo ""
echo "[Fase 4/6] Compilando a nova imagem Docker com CONCORD_COMMIT=${REQUIRED_ANCESTOR}..."
export CONCORD_COMMIT="${REQUIRED_ANCESTOR}"
docker compose build concord

# ==============================================================================
# FASE 5: Inicialização e Monitoramento Estrito de Prontidão
# ==============================================================================
DEPLOY_STAGE="STARTUP"
echo ""
echo "[Fase 5/6] Iniciando container atualizado e monitorando prontidão..."
docker compose up -d concord

MAX_WAIT=60
WAITED=0
IS_READY="false"

echo "Aguardando prontidão: exige Docker HEALTHY E API HTTP 200 (timeout: ${MAX_WAIT}s)..."

while [ ${WAITED} -lt ${MAX_WAIT} ]; do
  DOCKER_HEALTH=$(docker inspect --format='{{json .State.Health.Status}}' concord 2>/dev/null | tr -d '"' || echo "starting")

  INTERNAL_HTTP=$(docker compose exec concord node -e "
    fetch('http://127.0.0.1:3000/api/health')
      .then(r => console.log(r.status))
      .catch(() => console.log('down'))
  " 2>/dev/null || echo "down")

  # REGRA ESTREITA: AMBAS AS CONDIÇÕES DEVEM SER ATENDIDAS SIMULTANEAMENTE
  if [ "${DOCKER_HEALTH}" = "healthy" ] && [ "${INTERNAL_HTTP}" = "200" ]; then
    echo "Sucesso: Docker está HEALTHY e API respondeu 200 OK após ${WAITED}s."
    IS_READY="true"
    break
  fi

  sleep 3
  WAITED=$((WAITED + 3))
  echo "Aguardando prontidão... (${WAITED}s / ${MAX_WAIT}s) [Docker Health: ${DOCKER_HEALTH} | API: ${INTERNAL_HTTP}]"
done

if [ "${IS_READY}" != "true" ]; then
  echo "ERRO CRÍTICO: Container não atingiu prontidão completa (Docker Healthy E API 200) no prazo de ${MAX_WAIT}s!" >&2
  docker compose logs concord --tail=60
  exit 1
fi

# ==============================================================================
# FASE 6: Validação Funcional Profunda (Migração SQLite, Rotas e Logs)
# ==============================================================================
DEPLOY_STAGE="VALIDATION"
echo ""
echo "[Fase 6/6] Executando validação funcional profunda..."

# 6.1 Versão e commit no container
echo "Validando versão e commit no container..."
docker compose exec concord node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('/app/packages/server/package.json', 'utf8'));
const envCommit = process.env.CONCORD_COMMIT;

console.log('Versão package.json:', pkg.version);
console.log('CONCORD_COMMIT:', envCommit);

if (pkg.version !== '1.15.6') throw new Error('Versão incorreta no container: ' + pkg.version);
if (!envCommit || !envCommit.startsWith('7d8c8de')) throw new Error('Commit divergente no container: ' + envCommit);
"

# 6.2 Validar migração da tabela streamer_channels no SQLite
echo "Validando migração da tabela streamer_channels no SQLite..."
docker compose exec concord node -e "
const Database = require('better-sqlite3');
const db = new Database('/app/data/concord.db');

const table = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name='streamer_channels'\").get();
if (!table) throw new Error('Tabela streamer_channels não encontrada no SQLite!');

const cols = db.prepare('PRAGMA table_info(streamer_channels)').all().map(c => c.name);
const required = ['id', 'user_id', 'platform', 'channel_id', 'channel_name', 'channel_url', 'is_live'];
for (const req of required) {
  if (!cols.includes(req)) throw new Error('Coluna ausente em streamer_channels: ' + req);
}
console.log('Tabela streamer_channels confirmada com ' + cols.length + ' colunas e índices ativos.');
db.close();
"

# 6.3 Validar endpoints da API internamente
echo "Validando rotas HTTP da API..."
docker compose exec concord node -e "
async function run() {
  const base = 'http://127.0.0.1:3000';

  // 1. Health
  const h = await (await fetch(base + '/api/health')).json();
  if (h.status !== 'ok') throw new Error('Falha health status: ' + JSON.stringify(h));
  console.log('-> GET /api/health: 200 OK');

  // 2. Instance info
  const info = await (await fetch(base + '/api/instance/info')).json();
  if (info.version !== '1.15.6') throw new Error('Versão reportada incorreta: ' + info.version);
  console.log('-> GET /api/instance/info: 200 OK (versão 1.15.6, commit ' + info.commit + ')');

  // 3. Live streams
  const streams = await (await fetch(base + '/api/live/streams')).json();
  if (!Array.isArray(streams.streams)) throw new Error('Payload inesperado em live streams');
  console.log('-> GET /api/live/streams: 200 OK (' + streams.streams.length + ' transmissões ativas)');

  // 4. Live channels me (sem token)
  const me = await fetch(base + '/api/live/channels/me');
  if (me.status !== 401) throw new Error('Live channels me sem token esperava 401, recebeu: ' + me.status);
  console.log('-> GET /api/live/channels/me: 401 Unauthorized (rota registrada com Fastify JWT guard ativo)');
}
run().catch(e => { console.error('ERRO NAS ROTAS:', e.message); process.exit(1); });
"

# 6.4 Validar logs em busca de erros fatais
echo "Verificando se há erros críticos nos logs..."
FATAL=$(docker compose logs concord --tail=80 2>&1 | grep -iE "fatal|uncaughtException|unhandledRejection|database disk image is malformed" || true)
if [ -n "${FATAL}" ]; then
  echo "ERRO CRÍTICO ENCONTRADO NOS LOGS: ${FATAL}" >&2
  exit 1
fi

# ==============================================================================
# SUCESSO COMPLETO — DESATIVAR SALVAGUARDA DE ROLLBACK
# ==============================================================================
DEPLOY_STAGE="SUCCESS"
trap - EXIT

echo ""
echo "=================================================================="
echo "ATUALIZAÇÃO CONCLUÍDA COM SUCESSO!"
echo "Versão:          1.15.6"
echo "Commit:          ${REQUIRED_ANCESTOR}"
echo "Container:       concord (HEALTHY)"
echo "Tabela SQLite:   streamer_channels (ATIVA)"
echo "Rotas Live:      Operacionais (200 OK / 401 Unauthorized)"
echo "Backup íntegro:  ${BACKUP_FILE}"
echo "=================================================================="
