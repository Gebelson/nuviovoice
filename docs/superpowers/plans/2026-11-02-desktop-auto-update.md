# Nuvio Desktop Auto-Update & Permanent Update Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize Nuvio Desktop with the latest web features, bump version to 1.13.0 across all packages, implement a permanent Discord-like update button in the bottom-left corner with call protection, build the Windows NSIS installer and update metadata (`latest.yml`, `.blockmap`), and publish the stable release.

**Architecture:** The desktop updater uses `electron-updater` in the main process communicating via IPC with `updateStore.ts` in the web frontend. A new persistent UI component (`DesktopUpdateButton.tsx`) sits above the bottom-left user controls panel in `floatingPanel`, reflecting the real lifecycle (`available`, `downloading %`, `ready to restart`, `failed`) even after the transient toast is dismissed. Call protection gates restarts against active voice/video/screenshare sessions. Monorepo versions are bumped in lockstep using `bump-version.mjs`.

**Tech Stack:** Electron 43, `electron-updater` 6, `electron-builder` 26, React 19, TypeScript 5.7, Tailwind CSS, Vitest.

**Spec:** User request in conversation c0268256-a68d-4b38-9c73-c7bd45e452be ("NUVIO — Atualização automática do aplicativo Desktop com botão permanente, como no Discord").

---

## Global Constraints

- Never show the desktop update button or desktop-only controls in the Web build (`isElectron() === false`).
- The permanent update button MUST remain accessible across all pages (Friends, Spaces, Shop, Bots, DMs, Settings) as long as an update is pending (`available`, `downloading`, `ready`, `failed`), regardless of whether the user clicked "Mais tarde" on the initial toast.
- Never restart or disrupt an active voice/video call or screen share without explicit user confirmation.
- Version numbers must move strictly in lockstep across all `package.json` manifests via `scripts/bump-version.mjs`.
- No hardcoded stale fallback versions in `preload.ts`.
- Maintain full backward compatibility with user data, session tokens, audio/video settings, and local cache across updates.
- All code must pass `pnpm typecheck` (0 errors) and all unit test suites before release.

---

## Review Focus

1. **Dismissed Toast vs Permanent Button**: When `dismissUpdate()` is called, the transient `UpdateToast` disappears, but `DesktopUpdateButton` must stay visible and clickable.
2. **Call Interruption Safety**: If `inActiveCall` is true when clicking "Reiniciar e atualizar", a confirmation modal must intercept the restart and allow postponing.
3. **Real Download Progress**: The percentage must reflect the actual download progress reported by `electron-updater` (`status.percent`), not simulated timers.
4. **Preload Version Drift**: `window.nuvioConfig.version` must resolve dynamically from `app.getVersion()` rather than a hardcoded string.
5. **Installer and Metadata Integrity**: `Nuvio-Setup.exe`, `latest.yml`, and `Nuvio-Setup.exe.blockmap` must be verified and match SHA-256 hashes.

---

## Task Breakdown

### Task 1: Version Bump & Monorepo Synchronization to v1.13.0
**Files:**
- Modify: `package.json`
- Modify: `packages/desktop/package.json`
- Modify: `packages/server/package.json`
- Modify: `packages/shared/package.json`
- Modify: `packages/web/package.json`
- Modify: `packages/desktop/src/preload.ts`

- [ ] Run `node scripts/bump-version.mjs 1.13.0` to bump all manifests.
- [ ] In `packages/desktop/src/preload.ts`, replace the hardcoded fallback `version: '1.11.0'` with dynamic sync from `syncConfig.version`.
- [ ] Verify version consistency test passes: `pnpm --filter @concord/desktop test test/version-consistency.test.ts`.

### Task 2: Compile Latest Web Bundle & Copy to Desktop
**Files:**
- Output: `packages/web/dist`
- Output: `packages/desktop/web-dist`

- [ ] Run `pnpm --filter @concord/web build` to generate the latest production web bundle including all recent features (Security Center, Verifications, Privacy Settings, Winks fixes).
- [ ] Run `node scripts/copy-web.js` in `packages/desktop` to sync `web-dist`.
- [ ] Verify that `packages/desktop/web-dist/index.html` and assets match the newest web build.

### Task 3: Call Safety Dialog Component
**Files:**
- Create: `packages/web/src/components/modals/CallActiveUpdateModal.tsx`
- Test: `packages/web/src/components/modals/CallActiveUpdateModal.test.tsx`

- [ ] Create `CallActiveUpdateModal.tsx` rendering a warning dialog: "Você está em uma chamada. Reiniciar o Nuvio encerrará sua conexão." with buttons "Atualizar depois" and "Reiniciar e atualizar".
- [ ] Write unit test for `CallActiveUpdateModal.test.tsx` verifying callbacks and accessible labels.

### Task 4: Permanent Desktop Update Button Component
**Files:**
- Create: `packages/web/src/components/layout/DesktopUpdateButton.tsx`
- Modify: `packages/web/src/components/layout/ChannelSidebar.tsx`
- Test: `packages/web/src/components/layout/DesktopUpdateButton.test.tsx`

- [ ] Create `DesktopUpdateButton.tsx`:
  - Hook into `useUpdateStore` (`snapshot`, `install`, `checkNow`).
  - Hook into `useVoiceStore` (`currentVoiceChannelId`, `activeDmCall`).
  - Returns `null` if not on Electron or if status is `idle`, `up-to-date`, or capability is `external`.
  - State `available`: Renders button "Atualizar Nuvio" with download icon.
  - State `downloading`: Renders progress bar and "Baixando X%".
  - State `ready`: Renders "Reiniciar e atualizar" with restart icon. When clicked, if user is in call, shows `CallActiveUpdateModal`; otherwise calls `install()`.
  - State `failed`: Renders "Tentar novamente" with alert icon. When clicked, calls `checkNow()`.
- [ ] Integrate `DesktopUpdateButton` into `ChannelSidebar.tsx` floating panel right above `UserAreaPanel`.
- [ ] Write comprehensive unit tests in `DesktopUpdateButton.test.tsx` covering all 4 states, click behaviors, call protection interception, and hidden states on web.

### Task 5: Enhance Settings Updates Panel
**Files:**
- Modify: `packages/web/src/components/modals/settingsPanels/DesktopPanel.tsx`

- [ ] In `DesktopPanel.tsx`:
  - Ensure the "Atualizações" section displays:
    - Current installed version (`app.getVersion()`).
    - Latest available version (from `status.version`).
    - Real download percentage bar when downloading.
    - Call protection intercept when clicking "Reiniciar e atualizar".
    - "Verificar atualizações" action button with disabled state during checking.

### Task 6: Monorepo Verification & Test Suites
**Files:** All project packages

- [ ] Run `pnpm typecheck` across all packages (Shared, Server, Web).
- [ ] Run `pnpm --filter @concord/desktop test`.
- [ ] Run `pnpm --filter @concord/web test`.
- [ ] Run `pnpm smoke:web`.

### Task 7: Build Windows Installer & Update Metadata
**Files:**
- Output: `packages/desktop/dist-electron/Nuvio-Setup.exe`
- Output: `packages/desktop/dist-electron/Nuvio-Setup.exe.blockmap`
- Output: `packages/desktop/dist-electron/latest.yml`
- Output: `packages/desktop/dist-electron/SHA256SUMS.txt`

- [ ] Compile desktop TypeScript: `pnpm --filter @concord/desktop build:ts`.
- [ ] Run `electron-builder --win --x64` in `packages/desktop` to generate the NSIS installer and update feeds.
- [ ] Verify that `Nuvio-Setup.exe`, `latest.yml`, and `Nuvio-Setup.exe.blockmap` exist and have valid hashes.
- [ ] Generate `SHA256SUMS.txt`.

### Task 8: Commit, Git Tag & Release Publishing
**Files:** Repo root

- [ ] Review `git status` and `git diff`.
- [ ] Commit: `chore(release): bump to v1.13.0 and implement permanent desktop update button`.
- [ ] Create Git tag: `git tag v1.13.0`.
- [ ] Push commit and tag to `origin main` on GitHub `Gebelson/nuviovoice`.
- [ ] Verify GitHub release workflow trigger and release creation.
