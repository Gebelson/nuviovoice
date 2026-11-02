# Plano de Implementação — Central de Segurança e Cooperação com Autoridades

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar na administração do Nuvio um sistema profissional e completo de Segurança, Tratamento de Denúncias, Preservação de Evidências e Cooperação com Autoridades Brasileiras (Marco Civil, LGPD, ECA, CF/88), além de ferramenta CLI segura para promoção da conta `@gebelson`, sem vigilância indiscriminada ou leitura irrestrita de conversas privadas.

**Architecture:**
1. **Banco de Dados & Evidências:** Tabelas para denúncias (`safety_reports`), evidências voluntárias com SHA-256 (`safety_report_evidences`), casos investigativos (`security_cases`), cofre de evidências (`evidence_vault`), solicitações de autoridades e preservação legal (`authority_requests`), alertas técnicos de abuso (`security_alerts`) e trilha de auditoria imutável (`security_audit_logs`).
2. **CLI de Promoção Segura:** Script administrativo idempotente `promote-admin.ts` para localizar a conta `@gebelson`, validar integridade local e efetivar a promoção com registro formal de auditoria.
3. **Detecção e Alertas Comportamentais:** Mecanismo proporcional baseado em sinais técnicos objetivos (picos de solicitações, abusos de convites, taxas de bloqueio) sem varredura ou leitura de texto em DMs.
4. **Fluxos de Denúncia no Cliente:** Modais para denúncia de mensagens (1:1, grupos e espaços) com seleção granular de evidências e cálculo de hash, e denúncia de espaços suspeitos.
5. **Central de Segurança no Frontend:** Painel integrado em Administração com 9 áreas completas (Visão Geral, Denúncias, Alertas, Usuários, Espaços, Solicitações de Autoridades, Evidências, Auditoria e Políticas de Segurança).

**Tech Stack:** TypeScript, SQLite (Better-SQLite3), Drizzle ORM, Fastify, React, Tailwind CSS, Zustand, Vitest, Web Crypto / Node crypto.

**Spec:** Requisitos descritos no prompt do usuário (# NUVIO — Central de Segurança e Cooperação com Autoridades, com Privacidade e Conformidade Legal).

## Global Constraints

- **Sem vigilância indiscriminada:** Não criar rotas de "ler todas as DMs", busca global em conteúdo de mensagens privadas, nem escutas ou quebra de criptografia.
- **Minimização de dados:** Administradores e autoridades só acessam evidências fornecidas explicitamente pelo denunciante ou mediante ordem judicial legalmente válida.
- **Integridade de Evidências:** Toda evidência anexada recebe hash criptográfico SHA-256 na ingestão para garantir a cadeia de custódia.
- **Conteúdo ilícito extremo (ECA/CSAM):** Isolamento total, sem pré-visualizações desnecessárias e sem uso para treinamento de modelos.
- **Auditoria obrigatória:** Todas as ações na Central de Segurança (visualização de evidências, suspensões, atendimento a ofícios) são registradas com justificativa.
- **Promoção segura de `@gebelson`:** Não usar senhas fixas ou promoção cega; verificar conta local, registrar em auditoria e manter idempotência.

## Review Focus

1. **Acesso não autorizado a DMs:** Garantir que o endpoint `GET /api/admin/security/reports/:id` retorne *apenas* as mensagens voluntariamente selecionadas como evidência, e nunca o histórico completo da conversa.
2. **Tentativa de acesso por usuário comum:** Rotas sob `/api/admin/security/*` devem retornar estritamente 403 Forbidden para não-administradores.
3. **Cadeia de custódia de evidências:** O hash SHA-256 gerado no envio deve bater exatamente com os dados recuperados do cofre.
4. **Isolamento de denúncias CSAM:** Marcação especial que impede renderização automática no navegador e exige confirmação e justificativa explícita de acesso.
5. **Segurança do script de promoção:** O script deve rejeitar contas inexistentes, federadas ou deletadas, registrando a operação em log de auditoria.

---

### Task 1: Banco de Dados, Esquemas e Migração da Central de Segurança

**Files:**
- Modify: `packages/server/src/db/schema.ts`
- Modify: `packages/server/src/db/migrate.ts`
- Create: `packages/server/drizzle/0038_security_center_and_authorities.sql`
- Test: `packages/server/src/db/migrate.security.test.ts`

**Interfaces:**
- Produces:
  - Tabelas Drizzle: `safetyReports`, `safetyReportEvidences`, `securityCases`, `evidenceVault`, `authorityRequests`, `securityAlerts`, `securityAuditLogs`.
  - Tipos TypeScript compartilhados em `packages/shared/src/types.ts`.

- [ ] **Step 1: Escrever teste de migração para as novas tabelas de segurança**
- [ ] **Step 2: Rodar o teste para confirmar falha**
- [ ] **Step 3: Adicionar interfaces e enums em `packages/shared/src/types.ts`**
- [ ] **Step 4: Adicionar definições de tabelas em `packages/server/src/db/schema.ts` e arquivo SQL `0038`**
- [ ] **Step 5: Implementar verificação e criação em `packages/server/src/db/migrate.ts`**
- [ ] **Step 6: Executar testes de migração e verificar sucesso**
- [ ] **Step 7: Commit**

---

### Task 2: Script CLI Seguro de Promoção Administrativa da Conta `@gebelson`

**Files:**
- Create: `packages/server/src/scripts/promote-admin.ts`
- Create: `packages/server/src/scripts/promote-admin.test.ts`
- Modify: `packages/server/package.json` (adicionar script `promote-admin`)

**Interfaces:**
- Produces:
  - Função `promoteAdminAccount(db, options)` que valida e promove a conta local `@gebelson`, registrando em `securityAuditLogs`.
  - CLI executável via `pnpm --filter @concord/server run promote-admin`.

- [ ] **Step 1: Escrever testes unitários em `promote-admin.test.ts`**
  - Testa promoção de conta local existente.
  - Testa recusa de conta inexistente.
  - Testa recusa de conta replicada/federada (`homeInstance !== null`).
  - Testa recusa de conta deletada (`isDeleted = 1`).
  - Testa idempotência (se já for admin, não duplica e avisa).
  - Testa inserção do registro em `securityAuditLogs`.
- [ ] **Step 2: Rodar teste para verificar falha inicial**
- [ ] **Step 3: Implementar `promote-admin.ts` com validação de ID interno e autorização**
- [ ] **Step 4: Executar testes e validar funcionamento**
- [ ] **Step 5: Commit**

---

### Task 3: Backend de Denúncias de Usuários (Mensagens e Espaços) com Hashing de Evidências

**Files:**
- Create: `packages/server/src/routes/reports.ts`
- Create: `packages/server/src/utils/evidenceHasher.ts`
- Modify: `packages/server/src/routes/index.ts` (ou registro no app Fastify)
- Test: `packages/server/src/routes/reports.test.ts`

**Interfaces:**
- Produces:
  - `POST /api/reports/message`: cria denúncia de mensagem (1:1, grupo ou espaço) com evidências específicas e SHA-256.
  - `POST /api/reports/space`: cria denúncia de espaço.
  - Formato de protocolo: `REP-<timestamp>-<hash>`.

- [ ] **Step 1: Escrever testes em `reports.test.ts`**
  - Usuário denuncia mensagem da qual é membro: cria denúncia e registra hash de evidência.
  - Usuário tenta denunciar mensagem de canal ao qual não tem acesso: retorna 403 Forbidden.
  - Validação de categoria, descrição e cálculo SHA-256 das evidências.
  - Denúncias com categoria de exploração infantil (`csam_exploitation`) ou ameaça grave recebem prioridade `urgent` automaticamente.
- [ ] **Step 2: Rodar teste para verificar falha inicial**
- [ ] **Step 3: Implementar `evidenceHasher.ts` e `reports.ts`**
- [ ] **Step 4: Registrar rotas no servidor e executar testes**
- [ ] **Step 5: Commit**

---

### Task 4: Backend da Central de Segurança (Administração, Casos, Cofre e Autoridades)

**Files:**
- Create: `packages/server/src/routes/securityAdmin.ts`
- Create: `packages/server/src/utils/securityAuditor.ts`
- Modify: `packages/server/src/routes/admin.ts`
- Test: `packages/server/src/routes/securityAdmin.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/admin/security/overview`: estatísticas reais derivadas do banco de dados.
  - `GET /api/admin/security/reports` & `GET /api/admin/security/reports/:id`: detalhes e evidências estritamente autorizadas.
  - `PATCH /api/admin/security/reports/:id`: atualização de status e notas.
  - `GET /api/admin/security/cases` & `POST /api/admin/security/cases`: gestão de casos de investigação.
  - `GET /api/admin/security/authorities` & `POST /api/admin/security/authorities`: solicitações de autoridades e preservação legal (Marco Civil Art. 15).
  - `GET /api/admin/security/evidence/:id`: acesso ao cofre com registro obrigatório de auditoria e verificação de integridade do hash.
  - `GET /api/admin/security/audit`: consulta de logs de auditoria administrativa.
  - `POST /api/admin/security/users/:id/suspend`: suspensão/reativação de conta.

- [ ] **Step 1: Escrever testes completos para a API de segurança administrativa**
  - Usuário não-admin é bloqueado com 403 em todos os endpoints.
  - Visualização de denúncia retorna apenas as mensagens anexadas como evidência (não vaza o canal).
  - Consulta ao cofre de evidências gera log de auditoria obrigatório.
  - Registro de ordem judicial e solicitação de preservação com prazo e identificação legal.
- [ ] **Step 2: Rodar teste para verificar falha inicial**
- [ ] **Step 3: Implementar `securityAuditor.ts` e `securityAdmin.ts`**
- [ ] **Step 4: Executar testes e verificar aprovação**
- [ ] **Step 5: Commit**

---

### Task 5: Motor de Detecção Preventiva Proporcional e Alertas Comportamentais

**Files:**
- Create: `packages/server/src/utils/securityAlerts.ts`
- Create: `packages/server/src/utils/securityAlerts.test.ts`
- Test: `packages/server/src/utils/securityAlerts.test.ts`

**Interfaces:**
- Produces:
  - `checkFriendRequestSpike(userId, db)`: detecta picos de pedidos em janelas curtas.
  - `checkBlockRateAnomaly(userId, db)`: identifica contas com volume atípico de bloqueios recebidos.
  - `evaluateUserBehaviorSignals(userId, db)`: gera alertas técnicos com explicações factuais, sem especular intenção.

- [ ] **Step 1: Escrever testes unitários para detecção de sinais agregados**
- [ ] **Step 2: Rodar teste para verificar falha inicial**
- [ ] **Step 3: Implementar `securityAlerts.ts`**
- [ ] **Step 4: Executar testes e confirmar aprovação**
- [ ] **Step 5: Commit**

---

### Task 6: Frontend — Modal de Denúncia de Mensagem e Espaço

**Files:**
- Create: `packages/web/src/components/modals/ReportMessageModal.tsx`
- Create: `packages/web/src/components/modals/ReportSpaceModal.tsx`
- Modify: `packages/web/src/components/chat/messageMenuItems.tsx`
- Modify: `packages/web/src/components/chat/Message.tsx`
- Modify: `packages/web/src/stores/uiStore.ts`
- Test: `packages/web/src/components/modals/ReportMessageModal.test.tsx`

**Interfaces:**
- Produces:
  - Botão "Denunciar mensagem" no menu de opções de qualquer mensagem (DMs individuais, DMs de grupo, canais públicos e privados).
  - Modal com seleção de motivo, descrição e exibição transparente das mensagens e metadados que serão enviados.
  - Notificação de toast com número do protocolo após envio.

- [ ] **Step 1: Escrever testes unitários em `ReportMessageModal.test.tsx`**
- [ ] **Step 2: Rodar teste para verificar falha inicial**
- [ ] **Step 3: Implementar `ReportMessageModal.tsx` e `ReportSpaceModal.tsx`**
- [ ] **Step 4: Integrar no menu de mensagens e gerenciar modal no `uiStore`**
- [ ] **Step 5: Executar testes e verificar sucesso**
- [ ] **Step 6: Commit**

---

### Task 7: Frontend — Central de Segurança Completa (9 Áreas)

**Files:**
- Create: `packages/web/src/components/modals/instanceSettingsPanels/SecurityPanel.tsx`
- Create: `packages/web/src/components/modals/instanceSettingsPanels/security/` (subcomponentes das 9 áreas)
- Modify: `packages/web/src/components/modals/settingsPanels/InstancePanel.tsx`
- Test: `packages/web/src/components/modals/instanceSettingsPanels/SecurityPanel.test.tsx`

**Interfaces:**
- Produces:
  - Subtab "Segurança" (`security`) em `InstancePanel.tsx`.
  - 9 Seções:
    1. Visão Geral (métricas reais derivadas da API).
    2. Denúncias (lista, triagem e inspeção restrita de evidências).
    3. Alertas de Segurança (sinais técnicos agregados).
    4. Usuários (suspensões com justificativa).
    5. Espaços (espaços com denúncias e ações).
    6. Solicitações de Autoridades (cadastro e atendimento a ofícios/ordens judiciais).
    7. Evidências (cofre com integridade SHA-256 e restrição para conteúdo sensível).
    8. Auditoria (trilha de ações de moderadores e administradores).
    9. Políticas de Segurança (termos legais, Marco Civil, LGPD, limites e salvaguardas).

- [ ] **Step 1: Escrever testes unitários em `SecurityPanel.test.tsx`**
- [ ] **Step 2: Rodar teste para verificar falha inicial**
- [ ] **Step 3: Implementar `SecurityPanel.tsx` e seus submódulos**
- [ ] **Step 4: Adicionar `security` às abas de `InstancePanel.tsx` e i18n correspondente**
- [ ] **Step 5: Executar testes de renderização e interação**
- [ ] **Step 6: Commit**

---

### Task 8: Verificação Completa, Testes de Regressão, Execução do Script CLI e Submissão

**Commands:**
- `pnpm --filter @concord/shared typecheck`
- `pnpm --filter @concord/server typecheck`
- `pnpm --filter @concord/web typecheck`
- `pnpm --filter @concord/server test` (novas suítes de segurança e regressões)
- `pnpm --filter @concord/web test`
- `pnpm --filter @concord/web build`
- `node scripts/check-i18n.mjs`
- Teste de execução da CLI de promoção

- [ ] **Step 1: Typechecks em todos os pacotes**
- [ ] **Step 2: Suítes completas de testes automatizados**
- [ ] **Step 3: Build de produção do frontend**
- [ ] **Step 4: Validação do script de promoção com `--dry-run` ou conta de teste**
- [ ] **Step 5: Commit final e push para o repositório**
