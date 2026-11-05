# Game Detection & Friend Activity System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Implement automatic game detection on Windows Desktop and rich activity display across the friends list, user profile popout, user profile modal, and activity panels in Nuvio (`Gebelson/nuviovoice`), matching Discord's utility while preserving Nuvio's unique visual identity.

---

## File Structure & Proposed Changes

- **Desktop Activity Detector & IPC:**
  - `packages/desktop/src/activityDetector.ts`: Update remote catalog URL to Nuvio's GitHub repo (`Gebelson/nuviovoice`), change User-Agent to `Nuvio-Desktop/1.0`, eliminate permanent failure on transient `execFile` error, support custom registered games and disabled games via `setRegisteredGames()`.
  - `packages/desktop/resources/games.json`: Add Roblox (`RobloxPlayerBeta.exe`, `RobloxPlayerLauncher.exe`, `RobloxPlayer.exe`), expand League of Legends and Genshin Impact executables, bump version to 2.
  - `packages/desktop/src/main.ts`: Add IPC handler for `set-registered-games`.
  - `packages/desktop/src/preload.ts`: Expose `setRegisteredGames` on `window.nuvio` and `window.backspace`.

- **Web Bridge & Activity Store:**
  - `packages/web/src/platform/activityBridge.ts`: Check both `window.nuvio` and `window.backspace`, sync `registeredGames` from `useUserPreferencesStore` to Electron via `setRegisteredGames`, handle detection and privacy toggles.
  - `packages/web/src/stores/activityStore.ts`: Make stop-game `pushActivities([])` instant without 5s debounce, reduce game-start debounce to 500ms, update local user's activity cache immediately on self-start.

- **Server Privacy Protection:**
  - `packages/server/src/ws/events.ts`: Ensure that if a user's status is `'offline'` (invisible), activities are silenced (`[]`) so invisible users never leak activity to others.

- **UI Components & Internationalization:**
  - `packages/web/src/locales/{en,pt,de,ru,zh}/common.json`: Add activity verb translations (`activity.playing`, `activity.listening`, `activity.watching`, `activity.streaming`, `activity.title`).
  - `packages/web/src/components/ui/ActivityCard.tsx`: Support compact inline format (icon + verb + game name + elapsed) and full card format.
  - `packages/web/src/components/chat/FriendsPage.tsx`: In `FriendItem` ("Disponível" and "Todos" tabs), query `activitiesFor` and display game activity subtitle (`🎮 Jogando Genshin Impact`) with controller icon.
  - `packages/web/src/components/ui/UserProfilePopout.tsx`: Render dedicated Activity section with controller icon, game name, and elapsed duration.
  - `packages/web/src/components/modals/UserProfileModal.tsx`: Render dedicated Activity card in profile modal.

- **Tests:**
  - `packages/desktop/test/activityDetector.test.ts`: Verify custom games, error resilience, remote URL, disabled games.
  - `packages/web/src/components/ui/ActivityCard.test.tsx`: Test formatted activity verbs and icons.
  - `packages/web/src/components/chat/FriendsPage.test.tsx`: Test friend item rich activity subtitle rendering.
  - `packages/web/src/components/ui/UserProfilePopout.test.tsx`: Test activity section rendering in popout.
  - `packages/web/src/components/modals/UserProfileModal.test.tsx`: Test activity section rendering in modal.
  - `packages/web/src/stores/activityStore.test.ts`: Test immediate stop transition and registered games synchronization.

---

## Tasks

### Task 1: Desktop Activity Detector Hardening & Catalog Update

- [ ] **Step 1: Write failing test in `packages/desktop/test/activityDetector.test.ts`**
  - Test custom game registration via `setRegisteredGames`.
  - Test disabled game filtering (`detectionEnabled: false`).
  - Test that transient `execFile` error does not terminate polling permanently.
  - Test remote URL points to `Gebelson/nuviovoice`.
- [ ] **Step 2: Run desktop tests to verify failure**
  - Run `pnpm --filter @concord/desktop test`.
- [ ] **Step 3: Implement fixes in `packages/desktop/src/activityDetector.ts` and `packages/desktop/resources/games.json`**
  - Change `REMOTE_URL` to `https://raw.githubusercontent.com/Gebelson/nuviovoice/main/packages/desktop/resources/games.json`.
  - Change `User-Agent` to `Nuvio-Desktop/1.0`.
  - Implement `setRegisteredGames(customGames)` and merge into process lookup with precedence.
  - Replace `hasErrored = true; stopActivityDetection()` with resilient error logging and retry.
  - Update `resources/games.json` with Roblox, League of Legends aliases, Genshin Impact aliases, version 2.
- [ ] **Step 4: Run desktop tests to verify they pass**
  - Run `pnpm --filter @concord/desktop test`.

---

### Task 2: IPC Communication for Custom Games & Preload Bridge

- [ ] **Step 1: Update `packages/desktop/src/main.ts` and `preload.ts`**
  - In `main.ts`, register `ipcMain.on('set-registered-games', (_event, games) => { setRegisteredGames(games); })`.
  - In `preload.ts`, expose `setRegisteredGames` on `desktopApi`.
- [ ] **Step 2: Update `packages/web/src/platform/activityBridge.ts`**
  - Use `window.nuvio || window.backspace`.
  - Subscribe to `useUserPreferencesStore` changes for `registeredGames` and send to Electron via `setRegisteredGames`.
  - Initial dispatch on `initActivityBridge()`.
- [ ] **Step 3: Run desktop and web typechecks**
  - Run `pnpm -r typecheck`.

---

### Task 3: Activity Store Responsiveness & Server Privacy Guard

- [ ] **Step 1: Write unit tests in `packages/web/src/stores/activityStore.test.ts`**
  - Verify empty activity `pushActivities([])` sends immediately without 5s delay.
  - Verify game start has reduced debounce (500ms) and immediately sets local state.
- [ ] **Step 2: Update `packages/web/src/stores/activityStore.ts`**
  - If `activities.length === 0`: clear timer, set `myActivities: null`, and `wsSendAll({ type: 'activity_update', activities: [] })` immediately.
  - If starting game: set `myActivities: activities`, debounce `wsSendAll` by 500ms instead of 5000ms.
- [ ] **Step 3: Guard invisible privacy in `packages/server/src/ws/events.ts`**
  - In `handleActivityUpdate`: If `connectionManager.getUserStatus(userId) === 'offline'`, set outgoing activities to `[]`.
- [ ] **Step 4: Run server and web activity store tests**
  - Run `pnpm --filter @concord/web test src/stores/activityStore.test.ts`.
  - Run `pnpm --filter @concord/server test`.

---

### Task 4: Rich Activity UI Formatting & Internationalization

- [ ] **Step 1: Add translation strings for activity verbs**
  - Edit `packages/web/src/locales/pt/common.json`, `en/common.json`, `de/common.json`, `ru/common.json`, `zh/common.json` with:
    - `"activity.title"`: "Atividade" / "Activity"
    - `"activity.playing"`: "Jogando {{name}}" / "Playing {{name}}"
    - `"activity.listening"`: "Ouvindo {{name}}" / "Listening to {{name}}"
    - `"activity.watching"`: "Assistindo {{name}}" / "Watching {{name}}"
    - `"activity.streaming"`: "Transmitindo {{name}}" / "Streaming {{name}}"
- [ ] **Step 2: Update `packages/web/src/components/ui/ActivityCard.tsx`**
  - Export helper `formatActivityLabel(activity, t): string` returning `🎮 Jogando {name}`, `🎧 Ouvindo {name}`, `📺 Assistindo {name}`, `🔴 Transmitindo {name}`.
  - Export component `ActivityBadge` or compact subtitle for user rows.
  - Update `ActivityCard` to display verb, controller icon, elapsed time with clean Nuvio glass-card styling.
- [ ] **Step 3: Write tests for `ActivityCard.tsx`**
  - Add tests in `packages/web/src/components/ui/ActivityCard.test.tsx` verifying verbs, icons, and elapsed time formatting.
  - Run `pnpm --filter @concord/web test ActivityCard.test.tsx`.

---

### Task 5: Friends List Integration ("Disponível" and "Todos" Tabs)

- [ ] **Step 1: Update `FriendItem` in `packages/web/src/components/chat/FriendsPage.tsx`**
  - Subscribe to `useActivityStore((s) => s.userActivities)`.
  - Retrieve friend's activity: `const activities = activitiesFor(userActivities, friend, friend._instanceOrigin)`.
  - When friend has rich activity and is not offline, display the controller icon and formatted activity verb (e.g. `🎮 Jogando Genshin Impact`) with duration beneath their display name, preserving existing layout height.
  - Fall back gracefully to `presenceLabel(t, friend.status)` when no rich activity exists.
- [ ] **Step 2: Write tests in `packages/web/src/components/chat/FriendsPage.test.tsx`**
  - Verify that a friend playing a game displays `🎮 Jogando ...` in the Online/All list.
  - Run `pnpm --filter @concord/web test FriendsPage.test.tsx`.

---

### Task 6: User Profile Cards & Modals (Popout & Modal)

- [ ] **Step 1: Add Activity Card to `packages/web/src/components/ui/UserProfilePopout.tsx`**
  - Subscribe to `useActivityStore((s) => s.userActivities)`.
  - Get activities: `activitiesFor(userActivities, user, origin)`.
  - If user is not offline and has rich activities, render an Activity section with title "Atividade", game controller icon, game name, elapsed time, and glass card styling.
- [ ] **Step 2: Add Activity Card to `packages/web/src/components/modals/UserProfileModal.tsx`**
  - In `UserProfileModal.tsx`, subscribe to `useActivityStore` and render the Activity card in the header / "About" tab when active.
- [ ] **Step 3: Write tests for `UserProfilePopout` and `UserProfileModal`**
  - Verify activity section renders when user has an active game.
  - Verify activity section is hidden when user has no active game or is offline.
  - Run `pnpm --filter @concord/web test UserProfilePopout.test.tsx UserProfileModal.test.tsx`.

---

### Task 7: Full Verification Across Monorepo

- [ ] **Step 1: Run full test suites**
  - `pnpm -r test`
- [ ] **Step 2: Run full typecheck**
  - `pnpm -r typecheck`

---

### Task 8: Synchronized Publication

- [ ] **Step 1: Run publication script**
  - Run `node scripts/publish-nuvio.mjs --bump patch` to bump to `v1.15.5`, commit, push to GitHub, build Windows desktop installer, and deploy to Vercel.
- [ ] **Step 2: Verify release on GitHub and Vercel**
  - Confirm GitHub release `v1.15.5` has installer assets and latest.yml.
  - Confirm Vercel deployment succeeded.
