# WorkLedger

Local-first engineering notebook — React + TypeScript, all data in IndexedDB, no server.

## Commands

```bash
npm run dev        # Vite dev server (localhost:5173)
npm run build      # TypeScript check (tsc -b) + Vite production build
npm run lint       # ESLint (flat config)
npm run preview    # Preview production build
npm run test       # Vitest (unit tests, *.test.ts next to the code in __tests__/)
```

IMPORTANT: Always run `npm run lint`, `npm run build` and `npm run test` after making changes. CI runs all three. Tests cover pure logic (sync engine, crypto, storage helpers, date math, parsers); UI behavior still needs a manual browser check.

## Project structure

Feature-based architecture following [bulletproof-react](https://github.com/alan2207/bulletproof-react) conventions. Code flows one direction: `shared → features → app`.

```
src/
  app/             # App shell, providers, cross-feature composition (FilterBanner,
                   # SettingsMenuItems, useEntryNavigation, StorageStatusBanner)
  components/      # Shared components (layout, UI primitives)
  hooks/           # Shared hooks (useKeyboardShortcuts, useIsMobile)
  storage/         # Global IndexedDB abstraction (idb library)
  utils/           # Shared utilities (dates, tag-colors, id generation)
  features/
    entries/       # CORE — entry CRUD, types, storage, search index
    editor/        # BlockNote editor, Excalidraw, custom specs
    sidebar/       # Navigation, filtering (tags + text), archive toggle
    search/        # Full-text search panel (⌘K)
    focus-mode/    # Single-entry focus view
    sync/          # E2E encrypted sync (optional, SyncProvider)
    theme/         # Dark/light mode
    ai/            # OPTIONAL — AI sidebar, fully gated & removable
    logseq-import/ # Logseq graph import (folder picker, conversion, loaded on demand)
```

Each feature owns its `components/`, `context/`, `hooks/`, `storage/`, `types/`, `utils/` as needed.

### Feature boundaries — IMPORTANT

- **Features MUST NOT import from other features' internal files.** Import only from a feature's public API (`index.ts`) or shared code (`src/components/`, `src/hooks/`, `src/storage/`, `src/utils/`).
- **Shared code (`src/hooks/`, `src/components/`, `src/utils/`) MUST NOT import from `src/features/`.** Exception: `useKeyboardShortcuts` is an orchestration hook in `src/hooks/` that ties feature contexts together — this is intentional.
- **`entries/` is the core data layer** — other features depend on its public API for types and data access.
- **Cross-feature composition happens in `src/app/`**, not inside features. Examples:
  - The editor is passed to `EntryStream`/`EntryCard` as an `Editor` component prop, so `entries/` never imports `editor/`.
  - Theme, font, storage (sync) and AI settings are passed to the sidebar as the `settingsItems` slot (`src/app/SettingsMenuItems.tsx`), so `sidebar/` never imports `ai/`, `theme/` or `sync/`.
  - `FilterBanner` and `useEntryNavigation` live in `src/app/` because they combine sidebar and entries state.

### Provider hierarchy (in AppProviders.tsx)

```
ThemeContext → EntriesProvider → SyncProvider → SidebarProvider → FocusModeProvider → AIProvider
```

Order matters: SyncProvider depends on EntriesProvider, SidebarProvider depends on EntriesProvider for data.

## Code style

- ES modules (`import/export`), never CommonJS
- Strict TypeScript (`strict: true`, `noUnusedLocals`, `noUnusedParameters`)
- Functional components with hooks only — no class components
- Tailwind CSS utility-first; custom theme variables prefixed `--color-notebook-*` in `src/app.css`
- Props interfaces defined directly above their component, not in separate type files
- Event handlers: `handle*` in components, `on*` in props (e.g., component has `handleClick`, parent passes `onClick`)
- Prefer composition (`children`/slots) over excessive props — split components when props grow beyond 5-6
- Never define nested render functions inside components — extract them as separate components
- No barrel files (`index.ts` re-exporting everything) except as feature public APIs — they break Vite tree-shaking

## State management

State is categorized, not centralized:

- **Component state** — `useState`/`useReducer` for local UI concerns. Start here, lift only when needed.
- **Feature state** — React Context per feature (`EntriesContext`, `SidebarContext`, `AIContext`, etc.). Keep state close to consumers.
- **Storage state** — IndexedDB via `src/storage/db.ts` and feature-specific wrappers in `features/*/storage/`. Never access IndexedDB directly from components.
- **URL state** — typed event bus (`src/utils/events.ts`) with `emit("navigate-entry")` / `on("navigate-entry")` for cross-entry navigation.

### Filtering architecture

Sidebar filtering uses two independent dimensions combined with AND logic. Text lookup is the search panel (⌘K, header icon), not a filter:
- `selectedTags: string[]`: exact tag match, toggled by clicking tags in the sidebar
- `selectedSignifiers: EntrySignifier[]`: signifier match
- Both managed in `SidebarContext`, both must pass for an entry to show. Saved filters store both (older saved filters without `signifiers` load as `[]`; the retired `textQuery` field is ignored and text-only filters are dropped on load)
- Tag and signifier chips come from `storedTags`/`storedSignifiers` (collected by the full read in `buildActiveSnapshot`, so no extra scan) merged with loaded entries. Building them from loaded entries only hid tags used outside the recent window
- Filters run over in-memory entries. Only the last 30 days are loaded normally, so `App.tsx` calls `setLoadAll(true)` while filters are applied in the main view (`isFiltering`) and trims back when they clear

## Common gotchas

- The search index is a **separate IndexedDB store** from entries. It must be updated whenever entries change: content saves, tag changes, create, import, archive (row removed), unarchive, sync merge. Archived entries have no search row
- **Entry writes go through `patchEntry`** (`entries/storage/entries.ts`): one readwrite transaction for get+put, and `updatedAt = max(Date.now(), prev.updatedAt + 1)` so sync last-write-wins stays monotonic under clock skew. Don't add new get-then-put paths
- **Autosave flushes on unmount, `pagehide` and `visibilitychange: hidden`**. Dropping the pending timer loses the last 500ms of typing. Autosave writes the entry first; index failures are logged, never block the save
- **`EntryEditor` detects external updates by blocks reference, not `updatedAt`**: the effect is keyed on `entry.blocks`. Metadata changes (pin, tags, signifier) bump `updatedAt` but keep the same `blocks` array, so they must not call `replaceBlocks`. `useAutoSave.isOwnOrOlder` skips every array this editor saved (saves can resolve out of order) and content stamped before its last save. `onChange` is ignored while external content is applied, otherwise pulled content is re-saved and pushed back
- **Blocks with their own debounce register a pre-save hook** (`editor/utils/pre-save.ts`). The entry's unmount flush runs before its blocks' cleanups, so Excalidraw writes pending strokes into the document when `useAutoSave` flushes (unmount, `pagehide`, tab hidden)
- **Archive is lazy**: `archivedEntries` stays empty until `refreshArchive()` is called (the archive view does this). `refresh()` does one `getAll` that rebuilds the active view, `archivedCount` (always current) and, once loaded, the archive. Don't add a second scan
- **Backlinks index is a single settings row with an in-memory parsed cache** (`entries/storage/backlinks.ts`). Use `updateBacklinksBatch` for bulk writes; per-entry calls in a loop are O(n x index size). Settings rows derived from entries register via `registerDerivedSetting` so `clearAllData` drops them
- **Adding a signifier breaks older clients**: `validateEntry`/`normalizeEntry` drop unknown signifiers, and the next edit on an old device pushes the entry without it. Release notes must tell users to update every synced device first (the `rfd` signifier shipped this way)
- **DB migrations (`src/storage/db.ts`) must be idempotent over real old data.** v5 removes the retired `note`/`task` signifiers; `validateEntry`/`normalizeEntry` also drop unknown signifiers from imports and sync
- **Entry downloads** go through `downloadEntry` (`editor/export.ts`, lazy-imported by `app/hooks/useEntryDownload.ts`, which shows progress and errors). Markdown runs `prepareBlocksForMarkdown` before BlockNote's `blocksToMarkdownLossy`: `entryLink` has no export rule and would vanish, so it becomes `[[displayText]]` text, and `excalidraw` becomes `[Drawing]`. PDF (`@react-pdf/renderer`) and Word (`docx`) share `entryToDocument` (`editor/utils/entry-document.ts`), which flattens blocks into a small closed set; `export/images.ts` rasterizes images and drawings to PNG (remote images need CORS, failures become a text placeholder). PDF and Word share `export/style.ts` (Google Docs defaults in IBM Plex Sans); without `STYLES` in `export/docx.ts` docx emits blue headings over Times New Roman. A new custom block or inline type needs a rule in both `entry-markdown.ts` and `entry-document.ts`
- **PDF/Word libraries are imported inside `entryToPdf`/`entryToDocx`**, never statically, so they stay in their own chunks that `markOptionalChunks` keeps out of the precache (these two formats need the network). The PDF embeds IBM Plex Sans from `@ibm/plex-sans` (static WOFF, `export/fonts.ts`; the app's fonts are subset variable WOFF2 the renderer can't embed). Characters the font lacks would print as garbage, so `fitToFont` replaces them using the loaded font's glyph coverage; code uses standard Courier and is fitted to Windows-1252. `entryToPdf` takes the font files as a parameter because the Node build in tests reads them from disk. Poppler (`pdftoppm`) renders bold wrong on later pages of these PDFs; check output in Preview or a browser
- Excalidraw is wrapped in an error boundary (`ExcalidrawBlock.tsx`) — drawing errors must not crash the app. Add error boundaries around other risky integrations too
- **Mobile (<768px, `useIsMobile`) is a different layout over the same state.** `EntryStream` gets `preview`: entries render as `EntryPreviewRow`s and open through focus mode (`actions.onFocus`), where `EntryDetailControls` (info panel, action sheet) replaces the toolbar and tags (`EntryCard bare`). Row ids stay `entry-<id>` so scroll/highlight navigation still works. `AppHeader` is sticky on every size; sticky section headers sit below it via `--app-header-h` (`AppShell` sets it to 0 when the header is hidden, as in the full-screen entry). Views switch through `useSidebarUI().setView`. Header controls from other features (new entry, AI toggle) go in `AppHeader`'s `actions` slot as `HeaderButton`s. The sidebar (menu icon, left) and AI sidebar (AI icon, right) toggles are always shown, `pressed` while open. Active filters go in the `filters` slot, which swaps the centered layout for a left-aligned bar and hides search; don't add `fixed` corner buttons, they drift out of line with the header. Toggles stay rendered with `pressed` instead of hiding, and the header is a 3-column grid, so the centered `ViewMenu` title and the buttons never shift. The view list is `SIDEBAR_VIEWS` (sidebar public API), shared by the sidebar and `ViewMenu`. Shrinking to mobile closes the sidebar; widening must not open it
- **Side panel widths are CSS variables** (`--sidebar-w`, `--ai-sidebar-w` on `<html>`), set by `useResizablePanel` and read by the panels, `AppShell` padding and `NewEntryButton`. A drag writes the variable once per frame without React state, so the entry stream's editors don't re-render; `html[data-resizing]` turns off transitions meanwhile. Don't hard-code `w-80`/`w-96` again
- **Weekly review shows one ISO week** (`reviewWeekKey` in `SidebarContext`, reset to the current week when the review opens). Week math uses local dates from `src/utils/weeks.ts`; `review-weeks.ts` only summarizes (`summarizeWeek`, `filterDays`). `ReviewStream` loads the selected week's days with `loadDay` (each day requested once), not `setLoadAll`, so stepping weeks never triggers a full scan
- **Form fields are 16px on mobile** (`app.css`): iOS zooms into smaller focused fields and stays zoomed. Dialog inputs that must open the keyboard use `autoFocus` (focus inside the tap), not a `setTimeout` focus
- **Dictation uses the browser's `SpeechRecognition`** (`editor/utils/dictation.ts`), started from the `/` menu in `EntryEditor` only where the browser has it. One session at a time (a new one ends the previous), and the microphone stops when the note unmounts. Browsers end continuous sessions after a pause, so `startDictation` restarts them and gives up after a few instant restarts. Chrome sends the audio to a web service (so it does not work offline) and Firefox has it in preview builds only (MDN compat data); keep the "may send the audio" wording in the menu item and changelog, and keep trying both constructor names
- Debounce timings: auto-save 500ms, search 200ms, sync push 2s. Don't change without testing UX
- Vite config has specific `optimizeDeps` for Excalidraw and PNG chunk libraries — don't remove without testing
- The landing page lives in a separate repo (`workledger-landing`), not in this repo
- **AI feature is fully optional**: gated by `useAIFeatureGate` (one instance, in `AIContext`). All AI code is in `src/features/ai/`; the app shell touches it only in `App.tsx`, `AppProviders.tsx`, `SettingsMenuItems.tsx` and `useKeyboardShortcuts`. `AISidebar` is lazy-loaded through `features/ai/sidebar.ts`, not `index.ts`, so it stays out of the main bundle
- Custom BlockNote schema extended with `excalidraw` block type and `entryLink` inline content — defined in `src/features/editor/components/EditorProvider.tsx`
- **Backlinks index must be updated on import and sync merge**: `importEntries()` and `applyRemoteEntries()` must update backlinks alongside the search index. Missing this means wiki-links won't generate "Referenced by" panels (was a real bug for import, fixed; sync merge had the same bug)
- **AI provider construction never throws** (`createProvider` returns null, `getProviderConfigError` explains why). `AIProvider` is wrapped in its own error boundary. A throw in render there once blanked the app on every reload because the bad URL was already saved
- **AI providers with web search** (Anthropic, OpenAI, OpenRouter) report `supportsWebSearch`; only actions with `webSearch: true` request it, and only when `settings.webSearch` is on. Sources pass through `toSource` (http/https only) before they are rendered as links
- **The Anthropic SDK is imported on first use** (`providers/anthropic.ts`), never statically: the provider factory runs in the startup bundle via `AIContext`. `markOptionalChunks` also keeps the SDK chunk out of the service worker precache. It runs with `dangerouslyAllowBrowser` because keys are the user's own and there is no server. Current Claude models reject `temperature`, and thinking counts toward `max_tokens`, so the provider sends `output_config.effort` and a 16K `max_tokens` floor
- **AI settings load generically**: `loadAISettings` reads every key of `DEFAULT_AI_SETTINGS` and parses by the default's type. A new setting needs only a default; a new connection field also goes in `DRAFT_FIELDS` (`utils/provider-draft.ts`), which keys the provider rebuild and ping
- **AI sidebar is a chat over saved threads** (`AISidebar.tsx`). A thread (`AIConversation`) keeps its action id (`frameworkId`), `title`, `targetEntryId` and topic `query`. `CHAT_ACTION` (id `research-ask`, so old threads still open) is the default; picking a prompt with a thread open starts a new one. A thread belongs to the target entry it was shown with: "Think with AI" on another entry hides it (derived from `shownWith`, not reset in an effect), so threads opened from the recent list survive. User messages that embed notes keep the typed text in `display`
- **Custom prompts live in the `settings` row `ai-prompts`** (JSON, parsed per item with zod in `storage/custom-prompts.ts`) and become actions through `customPromptToAction`. They are not synced: a synced record kind would need sync-engine support; older clients already skip payloads that fail `validateEntry`
- **"Add to note" goes through `NoteActions`**, supplied by `app/hooks/useAINoteActions.ts`: the editor's `markdownToBlocks` (headless BlockNote, lazy import) plus `appendEntryBlocks`, which appends inside `patchEntry`'s transaction via a function patch. Don't read the entry and save full blocks; a concurrent autosave would be overwritten
- **AI images** are downscaled in `utils/images.ts` and stored on the user message. `providers/message-format.ts` converts them per API (chat completions parts, Responses `input_image`, Ollama base64 list); Anthropic uses `toAnthropicContent`. A new provider must convert `LLMMessage.images`, never send the field raw
- **AI conversation keys include the local day or ISO week** for day/week/standup actions; without that, "My Day" resumed the first summary ever generated. Only the latest stream may update state; streams abort on Back, action switch, target change and unmount
- **All imports go through `saveImportedEntries`** (`entries/storage/import-export.ts`): it keeps the newer version, updates search and backlinks, and emits `entry-changed` so imported entries sync. A new import source must not write entries itself
- **Logseq import** converts Logseq markdown to standard markdown (`logseq-import/utils/logseq-markdown.ts`), then parses it with a headless BlockNote editor using `workledgerSchema`. Page links pass through the parser as `https://logseq.invalid/page/<name>` placeholder links and are swapped for `entryLink` inline content afterwards; a custom URL scheme could be dropped by link validation. Entry ids are a SHA-256 of graph folder plus file path, so re-imports update instead of duplicating. The conversion takes the parser as a parameter so it is testable without a DOM
- **Shiki uses `shiki/core` with explicit grammar imports** (`editor/utils/code-highlighter.ts`). The list must match `supportedLanguages` in `EditorProvider.tsx`. Importing the full `shiki` bundle emits ~300 language chunks that the service worker would precache
- **Stale tabs reload once on a failed lazy import** (`vite:preloadError` in `main.tsx`). Optional chunks aren't precached, so a tab from before a deploy requests hashed files the host no longer serves. A sessionStorage flag (cleared after 30s) prevents reload loops, and offline tabs don't reload
- **Service worker precache skips optional chunks** (Mermaid-to-Excalidraw, Excalidraw locales) via the `markOptionalChunks` plugin in `vite.config.ts`. Excalidraw is imported only on demand; don't add a module-level `import()` or a `manualChunks` entry for it, both pull it into startup
- **Lazy editor mounting (`useNearViewport`) must start `near = true`** — starting `false` renders short placeholders that break `scrollIntoView` positions. Starting `true` mounts all editors on first render, then IntersectionObserver unmounts far-away ones after the first frame
- **`EntryStream` progressive rendering uses per-day budgeting** — `useProgressiveRender` returns a budget that gets allocated across day groups, not a simple flat batch. Don't simplify to a global slice
- **Sync logic lives in `SyncEngine`** (`sync/engine/sync-engine.ts`), a plain class with no React dependency; `useSync` only binds it via `useSyncExternalStore`. Test sync behavior against the engine, not the hook
- **Sync: one operation at a time, coalescing queue.** Queued pushes merge into one (keeping `forceAll` if any request asked for it), queued pulls merge into one. Nothing is dropped while another operation runs
- **Sync: generation counter.** Every operation captures `generation`; disconnect, account changes and mode switches bump it, and late results are discarded. Never write config from a value captured before an `await`
- **Sync: cursor separation.** Push only updates `lastSyncAt`; pull only updates `lastSyncSeq` and `lastPullAt` (display only). Pull writing `lastSyncAt` disabled the recovery scan and lost edits (was a real bug, fixed)
- **Sync: dirty tracking uses change counters.** Dirty ids map to a counter; a push clears only ids whose counter is unchanged since it started, so edits made while a request is in flight stay dirty. `syncedAt` is taken before entries are read
- **Sync: recovery scan.** `updatedAt > lastSyncAt` runs on activation (startup, switching back to Remote) to catch edits from before this session. Configs from older versions (no `lastPullAt`) do one full rescan and one full re-pull from seq 0, which recovers v2 entries an old client skipped
- **Sync: tombstones are persisted** in the `settings` row `sync-tombstones` and cleared only after a successful push. They are recorded in Local mode too. A pulled copy of an entry with a pending tombstone is not applied
- **Sync: pull pagination cursor** uses the last entry's `serverSeq` per page, NOT the global `serverSeq`. Using global skips intermediate pages (was a real bug, fixed in v2.2.1). The stuck-cursor guard also returns the per-page cursor
- **Sync: push is batched** (default 100 entries / 900 KB; the reference server rejects bodies over 1 MB). Entries whose encrypted payload exceeds `maxPayloadChars` (700,000, the server's per-entry cap) are skipped before sending. A batch rejected with 413 is split in half until the culprit is alone; that entry is skipped, not retried forever. The server rejects a whole batch for one bad entry, so never send an entry you know it will refuse
- **Sync: requests time out** (`requestTimeoutMs`, default 30s) and fail with a typed `SyncHttpError`; 408, 429, 5xx and network errors retry with backoff
- **Sync: every local mutation emits an event.** Content, tags, pin, signifier, archive, unarchive and import emit `entry-changed`; delete and delete-all emit `entry-deleted`. A new mutation path that skips this never syncs
- **Sync: push debounce resets.** The 2s push timer resets on every `entry-changed`/`entry-deleted` event, so rapid edits batch into one push. Bulk operations (import, delete all) emit one event per entry; above a threshold the engine does one full read instead of per-entry reads
- **Sync: `connect()` is the initial reconciliation**: full pull, then batched push of every local entry. `generateSyncId()` (new account) also uploads every existing entry
- **Sync: `syncNow()` is a recovery tool**: full re-pull from seq 0 plus `forceAll` push
- **Sync: event listeners are active whenever an account exists**; only pushing depends on Remote mode, so changes made in Local mode are pushed after switching back
- **Sync: merge (`entries/storage/remote-entries.ts`, `applyRemoteEntries`)** applies a page in one transaction and keeps search and backlinks in step. Strict `>`: equal timestamps keep the local version. Deletions always win
- **Sync: payload v2.** The entry id is AES-GCM additional data, and `id`/`isDeleted` are inside the ciphertext. Decryption falls back to the v1 format so existing server data still reads. `integrityHash` is SHA-256 of the ciphertext (the server requires 64 hex chars), never of plaintext. Older clients can't read v2 entries until they update
- **Sync: self-hosted server URLs must be https** (plain http only for localhost, 127.0.0.1, [::1])

## CI & PR conventions

- GitHub Actions runs lint + build + test on every push to `main` and on all PRs (Node 22, ubuntu-latest)
- Releases triggered by `v*` tags
- Version tracked in `package.json` and `CHANGELOG.md` (Keep a Changelog format)
- Keep PRs focused on a single concern
- Update `CHANGELOG.md` under `[Unreleased]` for every change we make
- Never mention Claude or Anthropic or LLM in commit messages
- See @CONTRIBUTING.md for development setup
- Use fix: or feat: or chore: or perf: or docs: for your commit messages
