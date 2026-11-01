# Plano de Implementação — Privacidade de Descoberta de Amigos e Controle de Recebimento de Winks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar configurações reais e persistentes de privacidade para visibilidade em "Adicionar amigos" (Todos, Amigos de amigos, Ninguém) e controle de recebimento de Winks (ativado/desativado), com aplicação rigorosa no backend, sincronização em tempo real entre dispositivos e interface no painel de Privacidade e Segurança.

**Architecture:** 
1. Adicionar colunas `friend_discovery_visibility` e `receive_winks` na tabela `users` com migração retrocompatível (preservando `discoverable` legado para contas antigas e padronizando novas contas em `mutual_friends` e `receive_winks: 1`).
2. Implementar filtro SQL centralizado para `/api/social/discover` e `/api/social/search` garantindo que usuários com `nobody` fiquem ocultos e `mutual_friends` apareçam exclusivamente para visualizadores que compartilham amizades mútuas ativas.
3. Validar preferência `receive_winks` em `checkDmMessageCreate` rejeitando envios com status 403 e mensagens específicas para 1:1 e DMs de grupo.
4. Atualizar `PrivacyPanel.tsx` com seletor de 3 opções para descoberta e toggle para Winks, acompanhados de toasts de feedback e sincronização via WebSocket.

**Tech Stack:** TypeScript, SQLite (Better-SQLite3), Drizzle ORM, Fastify, React, Tailwind CSS, Zustand, Vitest.

**Spec:** Requisitos definidos no prompt do usuário (# NUVIO — Implementar privacidade de descoberta de amigos e controle de recebimento de Winks).

## Global Constraints

- Novas contas recebem por padrão `friendDiscoveryVisibility: 'mutual_friends'` e `receiveWinks: true`.
- Contas existentes preservam sua visibilidade anterior (`discoverable = 0` → `'nobody'`, `discoverable = 1` → `'everyone'`) e recebem `receiveWinks: true`.
- Apenas amizades confirmadas e ativas na tabela `friends` contam como amigos em comum (pedidos pendentes, membros de espaços em comum ou seguidores não contam).
- Filtragem obrigatória no backend: não retornar dados ocultos para filtrar no cliente.
- Winks enviados a destinatário que não aceita Winks devem ser rejeitados com 403 e mensagem `"Não foi possível enviar este Wink. O destinatário não está aceitando Winks."` (em 1:1) ou `"Não foi possível enviar o Wink nesta conversa."` (em grupo com algum membro desativado).
- Mensagens rejeitadas não podem ser inseridas no banco, nem gerar reprodução local ou mensagens fictícias.
- Manter o design system e componentes existentes do Nuvio (Dark/Light mode, toasts, switches, etc.).

## Review Focus

1. **Tentativa de contorno de visibilidade `nobody` via `/api/social/search?q=exact_username`:** o usuário deve permanecer estritamente oculto.
2. **Visualizador sem amigos buscando usuário com `mutual_friends`:** o usuário alvo nunca deve ser retornado para quem tem 0 amigos mútuos.
3. **Páginação e contagem total de descoberta:** a contagem e os offsets SQL devem considerar apenas usuários elegíveis, sem páginas vazias ou buracos no slice.
4. **Envio de Wink em DM de grupo onde 1 de N participantes desativou Winks:** envio é bloqueado para o grupo com a mensagem neutra `"Não foi possível enviar o Wink nesta conversa."`.
5. **Sincronização entre abas/dispositivos:** ao alterar a visibilidade ou recebimento de Winks em uma sessão, o evento `user_updated` deve atualizar o estado local de todas as sessões ativas sem exigir reload.

---

### Task 1: Schema e Migração do Banco de Dados

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/server/src/db/schema.ts`
- Modify: `packages/server/src/db/migrate.ts`
- Test: `packages/server/src/db/migrate.test.ts`

**Interfaces:**
- Produces:
  - `FriendDiscoveryVisibility = 'everyone' | 'mutual_friends' | 'nobody'`
  - `User.friendDiscoveryVisibility?: FriendDiscoveryVisibility`
  - `User.receiveWinks?: boolean`
  - `UpdateUserRequest.friendDiscoveryVisibility?: FriendDiscoveryVisibility`
  - `UpdateUserRequest.receiveWinks?: boolean`
  - Schema columns: `schema.users.friendDiscoveryVisibility`, `schema.users.receiveWinks`

- [ ] **Step 1: Escrever teste de migração para as novas colunas e valores padrão**

Adicionar em `packages/server/src/db/migrate.test.ts` teste validando:
- Inclusão das colunas `friend_discovery_visibility` e `receive_winks` na tabela `users`.
- Backfill de contas existentes: usuários com `discoverable = 0` recebem `'nobody'`; usuários com `discoverable = 1` recebem `'everyone'`.
- Default de `receive_winks` = 1.

- [ ] **Step 2: Rodar o teste para confirmar falha**

Run: `pnpm --filter @concord/server test src/db/migrate.test.ts`
Expected: FAIL (colunas não existem)

- [ ] **Step 3: Atualizar tipos compartilhados em `packages/shared/src/types.ts`**

Adicionar `FriendDiscoveryVisibility` (`'everyone' | 'mutual_friends' | 'nobody'`) e os campos `friendDiscoveryVisibility` e `receiveWinks` nas interfaces `User` e `UpdateUserRequest`.

- [ ] **Step 4: Atualizar `schema.ts` e implementar a migração em `migrate.ts`**

Em `packages/server/src/db/schema.ts`:
```ts
friendDiscoveryVisibility: text('friend_discovery_visibility').notNull().default('mutual_friends'),
receiveWinks: integer('receive_winks').notNull().default(1),
```
Em `packages/server/src/db/migrate.ts`:
Verificar existência das colunas via `PRAGMA table_info(users)`:
- Adicionar `friend_discovery_visibility TEXT DEFAULT 'everyone' NOT NULL`
- Adicionar `receive_winks INTEGER DEFAULT 1 NOT NULL`
- Executar backfill para contas antigas: `UPDATE users SET friend_discovery_visibility = 'nobody' WHERE discoverable = 0;`

- [ ] **Step 5: Executar teste de migração e verificar sucesso**

Run: `pnpm --filter @concord/server test src/db/migrate.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/types.ts packages/server/src/db/schema.ts packages/server/src/db/migrate.ts packages/server/src/db/migrate.test.ts
git commit -m "feat(privacy): add friend_discovery_visibility and receive_winks schema and migrations"
```

---

### Task 2: Atualização de Usuário, Sanitização e Sincronização S2S/WebSocket

**Files:**
- Modify: `packages/server/src/utils/sanitize.ts`
- Modify: `packages/server/src/routes/users.ts`
- Modify: `packages/server/src/routes/auth.ts`
- Test: `packages/server/src/routes/users.privacy.test.ts`

**Interfaces:**
- Consumes: Task 1 types and schema
- Produces:
  - Sanitized `User` contendo `friendDiscoveryVisibility` e `receiveWinks` quando `isSelf = true` ou no perfil do usuário.
  - Endpoint `PATCH /api/users/@me` aceitando e validando `friendDiscoveryVisibility` (`'everyone' | 'mutual_friends' | 'nobody'`) e `receiveWinks` (`boolean`).
  - Emissão de `user_updated` via WebSocket para sincronizar abas e dispositivos.

- [ ] **Step 1: Escrever testes unitários em `users.privacy.test.ts`**

Criar `packages/server/src/routes/users.privacy.test.ts`:
- Atualização válida de `friendDiscoveryVisibility` para `'everyone'`, `'mutual_friends'`, `'nobody'`.
- Rejeição (400) para valores inválidos de `friendDiscoveryVisibility`.
- Atualização válida de `receiveWinks` para `true` e `false`.
- Rejeição (400) para valores não booleanos de `receiveWinks`.
- Verificação de sincronização e reflexo em `GET /api/users/@me`.
- Registro de nova conta em `auth.ts` inicializa com `'mutual_friends'` e `receiveWinks: true`.

- [ ] **Step 2: Rodar teste para verificar falha inicial**

Run: `pnpm --filter @concord/server test src/routes/users.privacy.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar sanitização e rotas em `sanitize.ts`, `users.ts` e `auth.ts`**

1. Em `packages/server/src/utils/sanitize.ts`:
   Incluir `friendDiscoveryVisibility: (row.friendDiscoveryVisibility as FriendDiscoveryVisibility) || 'everyone'` e `receiveWinks: row.receiveWinks !== 0` no objeto do usuário.
2. Em `packages/server/src/routes/users.ts`:
   Validar campos no `PATCH /api/users/@me`:
   - `friendDiscoveryVisibility`: validar pertencimento a `['everyone', 'mutual_friends', 'nobody']`.
   - Se `friendDiscoveryVisibility` for `'nobody'`, manter `discoverable = 0`; se `'everyone' | 'mutual_friends'`, manter `discoverable = 1` para retrocompatibilidade.
   - `receiveWinks`: validar `typeof receiveWinks === 'boolean'`.
   - Ativar `hasProfileChange = true` para transmitir `user_updated` a todas as conexões do usuário.
3. Em `packages/server/src/routes/auth.ts`:
   Ao registrar novo usuário, definir `friendDiscoveryVisibility: 'mutual_friends'` e `receiveWinks: 1`.

- [ ] **Step 4: Executar testes de privacidade de usuário**

Run: `pnpm --filter @concord/server test src/routes/users.privacy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/utils/sanitize.ts packages/server/src/routes/users.ts packages/server/src/routes/auth.ts packages/server/src/routes/users.privacy.test.ts
git commit -m "feat(privacy): backend support for updating and sanitizing friend discovery and winks preferences"
```

---

### Task 3: Filtragem de Descoberta e Pesquisa de Amigos com Amigos em Comum

**Files:**
- Create: `packages/server/src/utils/friendDiscoveryRules.ts`
- Modify: `packages/server/src/routes/social.ts`
- Test: `packages/server/src/routes/social.discoveryPrivacy.test.ts`

**Interfaces:**
- Produces:
  - `buildDiscoveryVisibilityFilter(viewerId: string, db: BetterSQLite3Database): SQL`
  - Filtro SQL nas rotas `GET /api/social/discover` e `GET /api/social/search`

- [ ] **Step 1: Escrever testes completos para as 3 opções de visibilidade em `social.discoveryPrivacy.test.ts`**

Criar `packages/server/src/routes/social.discoveryPrivacy.test.ts`:
1. Usuário A com `everyone`: encontrado por B e C.
2. Usuário A com `mutual_friends`:
   - B é amigo de R, e R é amigo de A (amigo em comum): B encontra A na descoberta e na pesquisa.
   - C não tem amigos em comum com A: C NÃO encontra A na descoberta nem na pesquisa.
3. Usuário A com `nobody`: B e C não encontram A em nenhuma pesquisa ou descoberta.
4. Total count e paginação respeitam os filtros (sem páginas fantasmas).
5. Amizades existentes de A não são alteradas nem removidas.

- [ ] **Step 2: Rodar teste para verificar falha inicial**

Run: `pnpm --filter @concord/server test src/routes/social.discoveryPrivacy.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar `friendDiscoveryRules.ts` e integrar em `social.ts`**

Criar `packages/server/src/utils/friendDiscoveryRules.ts`:
- Função para buscar os IDs dos amigos de um visualizador.
- Consulta SQL indexada para encontrar todos os `userId` que compartilham pelo menos um amigo confirmado em comum.
- Construção de cláusula Drizzle SQL:
  ```ts
  or(
    eq(schema.users.friendDiscoveryVisibility, 'everyone'),
    and(
      eq(schema.users.friendDiscoveryVisibility, 'mutual_friends'),
      mutualUserIds.length > 0 ? inArray(schema.users.id, mutualUserIds) : sql`0 = 1`
    )
  )
  ```
Integrar em:
- `GET /api/social/discover`
- `GET /api/social/search`

- [ ] **Step 4: Executar testes de descoberta e pesquisa de amigos**

Run: `pnpm --filter @concord/server test src/routes/social.discoveryPrivacy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/utils/friendDiscoveryRules.ts packages/server/src/routes/social.ts packages/server/src/routes/social.discoveryPrivacy.test.ts
git commit -m "feat(privacy): filter social discovery and search by friendDiscoveryVisibility"
```

---

### Task 4: Bloqueio Backend de Envio de Winks por Destinatário e Grupo

**Files:**
- Modify: `packages/server/src/utils/dmMessageRules.ts`
- Test: `packages/server/src/routes/dm.winksPrivacy.test.ts`

**Interfaces:**
- Consumes: `schema.users.receiveWinks`, `schema.dmChannelMembers`
- Produces:
  - Bloqueio com HTTP 403 e código `winks_disabled_by_recipient` com mensagem `"Não foi possível enviar este Wink. O destinatário não está aceitando Winks."` em DMs 1:1.
  - Bloqueio com HTTP 403 e código `winks_disabled_in_group` com mensagem `"Não foi possível enviar o Wink nesta conversa."` em DMs de grupo onde qualquer participante tenha `receiveWinks = 0`.

- [ ] **Step 1: Escrever testes unitários em `dm.winksPrivacy.test.ts`**

Criar `packages/server/src/routes/dm.winksPrivacy.test.ts`:
1. Envio de Wink para usuário com `receiveWinks = 1` (sucesso 201).
2. Envio de Wink para usuário com `receiveWinks = 0` via `POST /api/dm/:id/winks` (rejeição 403 `winks_disabled_by_recipient`).
3. Envio de Wink disfarçado via `POST /api/dm/:id/messages` (rejeição 403 `winks_disabled_by_recipient`).
4. Rejeição em DM de grupo quando um dos membros tem `receiveWinks = 0` (403 `winks_disabled_in_group`).
5. Rejeição via evento WebSocket `dm_message_create` / `dm_wink_send`.

- [ ] **Step 2: Rodar teste para verificar falha inicial**

Run: `pnpm --filter @concord/server test src/routes/dm.winksPrivacy.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar validação em `packages/server/src/utils/dmMessageRules.ts`**

Em `checkDmMessageCreate`, quando `isWinkRequest`:
- Buscar os demais membros do canal em `dmChannelMembers` juntando com `users.receiveWinks`.
- Se algum membro tiver `receiveWinks === 0`:
  - Se for 1:1: retornar `refuse(403, 'winks_disabled_by_recipient', { message: 'Não foi possível enviar este Wink. O destinatário não está aceitando Winks.' })`.
  - Se for grupo: retornar `refuse(403, 'winks_disabled_in_group', { message: 'Não foi possível enviar o Wink nesta conversa.' })`.

- [ ] **Step 4: Executar testes de privacidade de Winks**

Run: `pnpm --filter @concord/server test src/routes/dm.winksPrivacy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/utils/dmMessageRules.ts packages/server/src/routes/dm.winksPrivacy.test.ts
git commit -m "feat(winks): enforce receiveWinks preference on 1:1 and group DMs"
```

---

### Task 5: Interface do Usuário em `PrivacyPanel.tsx` e Feedback Visual

**Files:**
- Modify: `packages/web/src/components/modals/settingsPanels/PrivacyPanel.tsx`
- Modify: `packages/web/src/components/modals/settingsPanels/PrivacyPanel.test.tsx`
- Modify: `scripts/i18n-pending.txt`

**Interfaces:**
- Consumes: `api.users.update`, `useAuthStore`, `useUIStore.addToast`
- Produces:
  - Seção "Descoberta de pessoas" com título `"Quem pode me encontrar em Adicionar amigos?"` e descrição `"Escolha quem pode encontrar seu perfil na descoberta de pessoas."` contendo seletor de 3 opções: "Todos", "Amigos de amigos", "Ninguém".
  - Seção "Winks" com título `"Receber Winks"` e descrição `"Permitir que outras pessoas enviem animações especiais para você nas mensagens privadas."` com switch toggle.
  - Toasts de feedback:
    - `"Preferências de privacidade atualizadas."` no sucesso.
    - `"Não foi possível salvar suas preferências. Tente novamente."` no erro.

- [ ] **Step 1: Escrever testes unitários para `PrivacyPanel.test.tsx`**

Testar:
1. Renderização das seções "Descoberta de pessoas" e "Winks".
2. Seleção de cada opção de descoberta ("Todos", "Amigos de amigos", "Ninguém") disparando `api.users.update` e toast de sucesso.
3. Toggle de "Receber Winks" disparando `api.users.update` e toast de sucesso.
4. Reversão de estado e toast de erro quando a chamada da API falha.

- [ ] **Step 2: Rodar teste para verificar falha inicial**

Run: `pnpm --filter @concord/web test src/components/modals/settingsPanels/PrivacyPanel.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar os componentes em `PrivacyPanel.tsx`**

1. Estruturar o seletor acessível de descoberta com as três opções (Todos, Amigos de amigos, Ninguém), com indicação visual do selecionado e `role="radiogroup"` / `role="radio"`.
2. Estruturar o toggle de Winks ("Receber Winks").
3. Integrar com `useAuthStore` e `useUIStore.getState().addToast`.
4. Tratar erros e reversão de estado otimista em caso de exceção na API.

- [ ] **Step 4: Executar testes de `PrivacyPanel.test.tsx`**

Run: `pnpm --filter @concord/web test src/components/modals/settingsPanels/PrivacyPanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/modals/settingsPanels/PrivacyPanel.tsx packages/web/src/components/modals/settingsPanels/PrivacyPanel.test.tsx scripts/i18n-pending.txt
git commit -m "feat(web): add friend discovery visibility selector and receive winks switch in PrivacyPanel"
```

---

### Task 6: Tratamento no Frontend do Envio de Wink para Destinatário Bloqueado

**Files:**
- Modify: `packages/web/src/components/chat/MessageInput.tsx`
- Test: `packages/web/src/components/chat/__tests__/winks.privacy.test.tsx`

**Interfaces:**
- Consumes: Erro 403 do backend com mensagem de recusa.
- Produces:
  - Exibição de toast com a mensagem exata retornada pelo servidor (ou tradução amigável).
  - Nenhuma animação local executada (`triggerWink` não é chamado).

- [ ] **Step 1: Escrever teste em `winks.privacy.test.tsx`**

Simular falha em `client.dm.sendWink` com erro 403 e validar que:
- Toast com a mensagem retornada pelo servidor é disparado.
- `triggerWink` não é invocado (nenhuma reprodução local é iniciada).

- [ ] **Step 2: Rodar teste para verificar**

Run: `pnpm --filter @concord/web test src/components/chat/__tests__/winks.privacy.test.tsx`
Expected: PASS ou ajustes mínimos em `MessageInput.tsx`.

- [ ] **Step 3: Ajustar `MessageInput.tsx` se necessário**

Garantir que mensagens específicas de erro da API sejam tratadas com prioridade em `describeError` e exibidas como toast `'warning'`.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/chat/MessageInput.tsx packages/web/src/components/chat/__tests__/winks.privacy.test.tsx
git commit -m "feat(winks): surface rejection feedback and prevent local playback when recipient refuses winks"
```

---

### Task 7: Verificação Completa e Integração

**Files:**
- Todos os arquivos do projeto envolvidos.

**Commands:**
- `pnpm --filter @concord/shared typecheck`
- `pnpm --filter @concord/server typecheck`
- `pnpm --filter @concord/web typecheck`
- `pnpm --filter @concord/server test` (suíte completa de winks, social e users)
- `pnpm --filter @concord/web test src/components/chat/__tests__/`
- `pnpm --filter @concord/web build`

- [ ] **Step 1: Executar typecheck em todos os pacotes**

Run: `pnpm --filter @concord/server typecheck && pnpm --filter @concord/web typecheck`
Expected: 0 erros.

- [ ] **Step 2: Executar testes de regressão do backend e frontend**

Run: `pnpm --filter @concord/server test src/routes/social.discoveryPrivacy.test.ts src/routes/dm.winksPrivacy.test.ts src/routes/users.privacy.test.ts`
Expected: Todos os testes passando.

- [ ] **Step 3: Executar build de produção do frontend**

Run: `pnpm --filter @concord/web build`
Expected: Build concluído com sucesso e service worker gerado.

- [ ] **Step 4: Commit e Push**

```bash
git push origin main
```
