# Sistema Completo de Verificação de Contas e Espaços Públicos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Este plano implementa o sistema oficial de autenticidade e verificação do Nuvio de ponta a ponta: modelos de dados compartilhados, banco de dados e migrações SQLite/Drizzle com auditoria, rotas seguras de solicitação e revisão administrativa, componente visual responsivo `VerificationBadge`, telas de solicitação para usuários e espaços públicos no Explorar, central administrativa completa com 6 abas e testes automatizados.

---

## Estrutura de Arquivos e Responsabilidades

### Novos Arquivos a Criar
1. **`packages/shared/src/verifications.ts`**:
   - Definições de tipos, enums, constantes e utilitários de categorias de verificação (`personal`, `creator`, `organization`, `official`, `space`), estados (`none`, `pending`, `under_review`, `info_requested`, `verified`, `rejected`, `revoked`), métodos de validação e textos explicativos de tooltips/acessibilidade.
2. **`packages/server/drizzle/0039_verifications_system.sql`**:
   - Migração versionada criando as tabelas `entity_verifications`, `verification_requests`, `verification_audit_logs` e colunas `verification_status` / `verification_category` em `users` e `spaces`.
3. **`packages/server/src/routes/verifications.ts`**:
   - Endpoints REST para criação e consulta de solicitações de usuários e espaços, verificação técnica de domínio/DNS, endpoints administrativos de análise, aprovação, recusa, solicitação de dados, revogação e concessão oficial restrita.
4. **`packages/server/src/routes/verifications.test.ts`**:
   - Testes unitários cobrindo permissões, requisições públicas vs administrativas, isolamento de dados e registro de auditoria.
5. **`packages/web/src/components/ui/VerificationBadge.tsx`**:
   - Componente visual acessível com Lucide `badge-check` e `shield-check`, tamanhos adaptativos (`sm`, `md`, `lg`), paleta temática (azul, verde, roxo), tooltip explicativo com escopo de autenticidade e disclaimers legais.
6. **`packages/web/src/components/ui/VerificationBadge.test.tsx`**:
   - Testes de renderização visual, acessibilidade, classes de cor e tooltips para todas as categorias.
7. **`packages/web/src/components/modals/settingsPanels/VerificationSection.tsx`**:
   - Seção de verificação em **Configurações → Minha Conta → Verificação**, exibindo estado atual e fluxo de solicitação com formulário seguro.
8. **`packages/web/src/components/modals/spaceSettingsPanels/SpaceVerificationSection.tsx`**:
   - Seção de verificação nas configurações de espaços públicos.
9. **`packages/web/src/components/modals/instanceSettingsPanels/VerificationsPanel.tsx`**:
   - Central administrativa com 6 abas (Visão Geral com métricas, Contas, Organizações, Espaços, Solicitações Pendentes com ações de decisão e Histórico/Auditoria).
10. **`packages/web/src/components/modals/instanceSettingsPanels/VerificationsPanel.test.tsx`**:
    - Testes do painel administrativo, filtros de fila e ações de aprovação/rejeição.

### Arquivos Existentes a Modificar
1. **`packages/shared/src/types.ts` & `packages/shared/src/index.ts`**:
   - Exportação dos tipos de verificação e adição dos campos opcionais `verification?: VerificationInfo | null` nos tipos `User` e `ExploreSpace`.
2. **`packages/server/src/db/schema.ts`**:
   - Adição das tabelas `entityVerifications`, `verificationRequests`, `verificationAuditLogs` e colunas nas tabelas `users` e `spaces`.
3. **`packages/server/src/db/migrate.ts` & `packages/server/drizzle/meta/_journal.json`**:
   - Registro das migrações pendentes (35 a 39) para execução garantida em in-memory SQLite e banco de produção.
4. **`packages/server/src/index.ts`**:
   - Registro das novas rotas de `/api/verifications`.
5. **`packages/server/src/routes/explore.ts`**:
   - Inclusão dos campos de verificação no payload de espaços e suporte ao filtro de consulta `verifiedOnly=true`.
6. **`packages/web/src/stores/exploreStore.ts`**:
   - Adição do filtro `verifiedOnly` e repasse na busca.
7. **`packages/web/src/components/chat/ExplorePage.tsx` & `SpaceCard.tsx`**:
   - Adição do selo `VerificationBadge` nos cards e toggle do filtro "Apenas verificados".
8. **`packages/web/src/components/modals/settingsPanels/InstancePanel.tsx`**:
   - Adição da aba "Verificações" na barra de navegação da instância.
9. **`packages/web/src/components/chat/MessageItem.tsx`**:
   - Exibição do selo ao lado do nome do autor nas mensagens.
10. **`packages/web/src/components/modals/UserProfileModal.tsx` & perfis/listas**:
    - Exibição do selo nos perfis de usuários e listas de amigos/membros.

---

## Tarefas de Implementação

### Tarefa 1: Modelos de Dados e Tipos Compartilhados (`@concord/shared`)
- [ ] Criar `packages/shared/src/verifications.ts` com categorias (`personal`, `creator`, `organization`, `official`, `space`), status (`none`, `pending`, `under_review`, `info_requested`, `verified`, `rejected`, `revoked`), métodos e interfaces.
- [ ] Atualizar `packages/shared/src/types.ts` estendendo `User` e `ExploreSpace`.
- [ ] Exportar novos símbolos em `packages/shared/src/index.ts`.
- [ ] Executar build de `@concord/shared` para validar tipagens.

### Tarefa 2: Banco de Dados, Esquema Drizzle e Migrações (`@concord/server`)
- [ ] Atualizar `packages/server/src/db/schema.ts` declarando as tabelas `entityVerifications`, `verificationRequests` e `verificationAuditLogs`, além das colunas `verification_status` e `verification_category` em `users` e `spaces`.
- [ ] Criar arquivo de migração `packages/server/drizzle/0039_verifications_system.sql`.
- [ ] Atualizar `packages/server/drizzle/meta/_journal.json` adicionando as entradas 35 a 39.
- [ ] Atualizar `packages/server/src/db/migrate.ts` para sincronizar os schemas no setup semântico.
- [ ] Executar script de migração e verificar integridade do SQLite.

### Tarefa 3: Endpoints da API de Verificação (`@concord/server`)
- [ ] Criar `packages/server/src/routes/verifications.ts`:
  - `POST /api/verifications/requests` (solicitação de conta)
  - `GET /api/verifications/me` (status e requisição ativa do usuário)
  - `POST /api/verifications/spaces/:spaceId/requests` (solicitação de espaço pelo dono/admin)
  - `GET /api/verifications/spaces/:spaceId` (status de verificação do espaço)
  - `POST /api/verifications/verify-domain` (checagem de DNS TXT ou HTTP token)
  - Endpoints administrativos com verificação estrita de `isAdmin`:
    - `GET /api/admin/verifications` (listagem filtrada)
    - `GET /api/admin/verifications/metrics` (contagens gerais)
    - `POST /api/admin/verifications/requests/:id/approve`
    - `POST /api/admin/verifications/requests/:id/reject`
    - `POST /api/admin/verifications/requests/:id/request-info`
    - `POST /api/admin/verifications/entities/:targetType/:targetId/revoke`
    - `POST /api/admin/verifications/official/grant` (concessão de equipe com verificação segura)
    - `GET /api/admin/verifications/audit` (trilha de auditoria)
- [ ] Registrar a rota em `packages/server/src/index.ts`.
- [ ] Atualizar `packages/server/src/routes/explore.ts` para retornar dados de verificação e aceitar `verifiedOnly=true`.
- [ ] Escrever testes unitários em `packages/server/src/routes/verifications.test.ts`.

### Tarefa 4: Componente Visual `VerificationBadge` (`@concord/web`)
- [ ] Criar `packages/web/src/components/ui/VerificationBadge.tsx` com ícones Lucide `badge-check` e `shield-check`, cores (azul, verde, roxo), tamanhos adaptativos e popover/tooltip informativo.
- [ ] Adicionar suporte a acessibilidade (`aria-label`, texto oculto para leitores de tela).
- [ ] Escrever testes de renderização em `packages/web/src/components/ui/VerificationBadge.test.tsx`.

### Tarefa 5: Solicitação de Verificação em Configurações (`@concord/web`)
- [ ] Criar `packages/web/src/components/modals/settingsPanels/VerificationSection.tsx` integrado em `AccountPanel.tsx`.
- [ ] Implementar formulário interativo de solicitação:
  - Escolha de categoria (Pessoa física, Criador, Organização).
  - Campos de dados públicos, redes sociais, links e comprovação técnica de domínio.
  - Alertas de privacidade e esclarecimento legal.
- [ ] Criar `packages/web/src/components/modals/spaceSettingsPanels/SpaceVerificationSection.tsx` e integrá-lo em `SpaceSettings.tsx`.

### Tarefa 6: Central Administrativa de Verificações (`@concord/web`)
- [ ] Criar `packages/web/src/components/modals/instanceSettingsPanels/VerificationsPanel.tsx`.
- [ ] Implementar as 6 abas completas:
  1. **Visão Geral**: cards métricos (contas, organizações, espaços, pendentes, recusados, revogados).
  2. **Contas**: listagem de usuários verificados com ação de revogação auditada e concessão de equipe oficial.
  3. **Organizações**: listagem de organizações verificadas.
  4. **Espaços**: listagem de espaços verificados.
  5. **Solicitações Pendentes**: fila de análise com modal de detalhes, visualização de evidências e botões (Aprovar, Recusar com justificativa, Solicitar Mais Informações).
  6. **Histórico e Auditoria**: logs detalhados de todas as ações administrativas.
- [ ] Integrar `VerificationsPanel` em `InstancePanel.tsx` como uma aba administrativa.
- [ ] Escrever testes do painel em `VerificationsPanel.test.tsx`.

### Tarefa 7: Integração da Verificação na Interface Geral (`@concord/web`)
- [ ] Atualizar `ExplorePage.tsx` e `SpaceCard.tsx`:
  - Exibir `VerificationBadge` ao lado do nome do espaço.
  - Adicionar o botão/toggle de filtro "Apenas verificados".
- [ ] Atualizar `MessageItem.tsx` para exibir `VerificationBadge` ao lado do autor.
- [ ] Atualizar `UserProfileModal.tsx`, `FriendsPage.tsx` e `MemberList.tsx` para renderizar os selos de autenticidade.
- [ ] Validar responsividade mobile garantindo que os nomes e ícones não quebrem o layout.

### Tarefa 8: Validação, Testes Automatizados e Deploy
- [ ] Executar `pnpm typecheck` em todo o workspace (0 erros).
- [ ] Executar testes de backend e frontend com Vitest.
- [ ] Executar build de produção (`pnpm build:web`).
- [ ] Executar smoke test automatizado de navegador (`pnpm smoke:web`).
- [ ] Realizar commit das alterações e push para `main` no GitHub.
- [ ] Aguardar deploy e validar via Playwright no endereço público `https://nuviovoice.vercel.app/`.
