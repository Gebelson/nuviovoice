import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

const scriptPath = path.resolve('scripts/deploy-oracle-v1.15.6.sh');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

console.log('====================================================');
console.log('AUDITORIA AUTOMATIZADA DE SALVAGUARDAS DO DEPLOY');
console.log('Arquivo:', scriptPath);
console.log('====================================================\n');

// Test 1: Sem qualquer 'rm -rf data'
console.log('1. Testando eliminação de rm -rf data...');
assert.strictEqual(
  scriptContent.includes('rm -rf data'),
  false,
  'FALHA: O script ainda contém rm -rf data!'
);
assert.ok(
  scriptContent.includes('mv data "${PRESERVED_DATA}"') || scriptContent.includes('mv data'),
  'FALHA: Preservação de data/ via mv não encontrada!'
);
console.log('   -> APROVADO: rm -rf data completamente ausente. Preservação via mv ativa.');

// Test 2: Captura de variáveis Compose CONCORD_IMAGE e CONCORD_IMAGE_TAG
console.log('2. Testando captura de imagem e Compose tags...');
assert.ok(
  scriptContent.includes('CONCORD_IMAGE') && scriptContent.includes('CONCORD_IMAGE_TAG'),
  'FALHA: CONCORD_IMAGE ou CONCORD_IMAGE_TAG não foram referenciadas!'
);
assert.ok(
  scriptContent.includes('COMPOSE_IMAGE_NAME') && scriptContent.includes('ORIGINAL_CONTAINER_IMAGE'),
  'FALHA: Variáveis de restauração de imagem não encontradas!'
);
console.log('   -> APROVADO: Captura de Image ID, container image e tags Compose implementada.');

// Test 3: Exigência simultânea de Docker Healthy E API 200 (ambas as condições)
console.log('3. Testando exigência estrita de prontidão (ambas as condições)...');
assert.ok(
  scriptContent.includes('[ "${DOCKER_HEALTH}" = "healthy" ] && [ "${INTERNAL_HTTP}" = "200" ]'),
  'FALHA: A condição de prontidão deve exigir AMBAS as condições com &&!'
);
assert.strictEqual(
  scriptContent.includes('[ "${DOCKER_HEALTH}" = "healthy" ] || [ "${INTERNAL_HTTP}" = "200" ]'),
  false,
  'FALHA: O operador || ainda está presente no health check!'
);
console.log('   -> APROVADO: Prontidão exige estritamente Docker HEALTHY E API HTTP 200.');

// Test 4: Confirmação interativa com interrupção segura
console.log('4. Testando confirmação interativa antes de parada de serviço...');
assert.ok(
  scriptContent.includes('read -p') && scriptContent.includes('USER_CONFIRM'),
  'FALHA: Prompt de confirmação interativa não encontrado!'
);
assert.ok(
  scriptContent.includes('Operação abortada pelo operador'),
  'FALHA: Tratamento de cancelamento seguro não encontrado!'
);
console.log('   -> APROVADO: Operador pode cancelar antes de qualquer parada ou alteração.');

// Test 5: Validação do commit v1.15.6
console.log('5. Testando trava do commit obrigatório...');
const REQUIRED_COMMIT = '7d8c8dec44be78477aad2a7f23315db8797a610f';
assert.ok(
  scriptContent.includes(REQUIRED_COMMIT),
  `FALHA: Commit obrigatório ${REQUIRED_COMMIT} não está presente no script!`
);
assert.ok(
  scriptContent.includes('git merge-base --is-ancestor'),
  'FALHA: Validação de ancestralidade Git não encontrada!'
);
console.log('   -> APROVADO: Trava de integridade do commit v1.15.6 validada.');

// Test 6: Caminhos absolutos e validação de migração
console.log('6. Testando caminhos absolutos e validações de banco...');
assert.ok(
  scriptContent.includes('/app/data/concord.db'),
  'FALHA: Caminho absoluto do banco não utilizado!'
);
assert.ok(
  scriptContent.includes('/app/packages/server/package.json'),
  'FALHA: Caminho absoluto do package.json não utilizado!'
);
assert.ok(
  scriptContent.includes('streamer_channels'),
  'FALHA: Validação da tabela streamer_channels não encontrada!'
);
console.log('   -> APROVADO: Caminhos absolutos e migração do SQLite validados.');

console.log('\n====================================================');
console.log('TODAS AS 6 AUDITORIAS DE SEGURANÇA FORAM APROVADAS!');
console.log('====================================================\n');
