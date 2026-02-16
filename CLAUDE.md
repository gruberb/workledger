# WorkLedger

Local-first engineering notebook — React + TypeScript, all data in IndexedDB, no server.

## Commands

```bash
npm run dev        # Vite dev server (localhost:5173)
npm run build      # TypeScript check (tsc -b) + Vite production build
npm run lint       # ESLint (flat config)
npm run preview    # Preview production build
```

IMPORTANT: Always run `npm run lint` and `npm run build` after making changes. There is no test suite — build and lint are the primary verification steps.

## Project structure

Feature-based architecture following [bulletproof-react](https://github.com/alan2207/bulletproof-react) conventions. Code flows one direction: `shared → features → app`.

```
src/
  app/             # App shell, providers, top-level orchestration
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
    theme/         # Dark/light mode
    ai/            # OPTIONAL — AI sidebar, fully gated & removable
```

Each feature owns its `components/`, `context/`, `hooks/`, `storage/`, `types/`, `utils/` as needed.

### Feature boundaries — IMPORTANT

- **Features MUST NOT import from other features' internal files.** Import only from a feature's public API (`index.ts`) or shared code (`src/components/`, `src/hooks/`, `src/storage/`, `src/utils/`).
- **Shared code (`src/hooks/`, `src/components/`, `src/utils/`) MUST NOT import from `src/features/`.** Exception: `useKeyboardShortcuts` is an orchestration hook in `src/hooks/` that ties feature contexts together — this is intentional.
- **`entries/` is the core data layer** — other features depend on its public API for types and data access.
- **Cross-feature composition happens in `src/app/App.tsx`**, not inside features.

### Provider hierarchy (in AppProviders.tsx)

```
ThemeContext → EntriesProvider → SidebarProvider → FocusModeProvider → AIProvider
```

Order matters: SidebarProvider depends on EntriesProvider for data.

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
- **URL state** — custom DOM event `workledger:navigate-entry` for cross-entry navigation, handled in `App.tsx`.

### Filtering architecture

Sidebar filtering uses two independent dimensions combined with AND logic:
- `selectedTags: string[]` — exact tag match, toggled by clicking tags in the sidebar
- `textQuery: string` — text search via search index + in-memory tag substring match
- Both managed in `SidebarContext`, both must pass for an entry to show

## Common gotchas

- The search index is a **separate IndexedDB store** from entries — it must be updated whenever entries are saved (handled by `useAutoSave` hook)
- Excalidraw is wrapped in an error boundary (`ExcalidrawBlock.tsx`) — drawing errors must not crash the app. Add error boundaries around other risky integrations too
- Debounce timings: auto-save 500ms, search 200ms, sidebar filter 200ms — don't change without testing UX
- Vite config has specific `optimizeDeps` for Excalidraw and PNG chunk libraries — don't remove without testing
- The `landing/` directory is a separate static site, not part of the React app
- **AI feature is fully optional** — gated by `useAIFeatureGate` hook. All AI code in `src/features/ai/`. Can be removed without affecting core functionality
- Custom BlockNote schema extended with `excalidraw` block type and `entryLink` inline content — defined in `src/features/editor/components/EditorProvider.tsx`
- **Sync: Mutex asymmetry** — push reschedules via `schedulePush()` when mutex is held; pull drops silently. Changing this breaks the guarantee that dirty entries are eventually pushed
- **Sync: Cursor separation** — push only updates `lastSyncAt`, only pull updates `lastSyncSeq`. Mixing these up causes entry loss (pull would skip server entries)
- **Sync: Dirty tracking is in-memory** — `dirtyEntriesRef` and `deletedEntriesRef` are `useRef` sets, lost on page refresh. The fallback filter `e.updatedAt > config.lastSyncAt` in push and `syncNow()` handle recovery
- **Sync: Pull pagination cursor** — uses the last entry's `serverSeq` per page, NOT the global `serverSeq` from the response. Using global skips intermediate pages (was a real bug, fixed in v2.2.1)
- **Sync: Push debounce resets** — the 2s push timeout resets on every `entry-changed`/`entry-deleted` event. Rapid edits batch into one push
- **Sync: `connect()` does a full bidirectional sync** — encrypts all local entries, sends them, receives all server entries, merges. It's the initial reconciliation, not just a "connect"
- **Sync: `syncNow()` resets `lastSyncSeq` to 0** — forces a full re-pull from the beginning, then `push(true)` sends everything. It's a recovery tool, not a regular sync
- **Sync: `unarchiveEntry` does NOT emit `entry-changed`** — unlike `archiveEntry`, it won't trigger a sync push. The unarchived state only syncs on next edit or manual `syncNow()`
- **Sync: Event listeners are mode-gated** — only registered when `config.mode === "remote"`. Mode switch tears down and re-creates them via `useEffect` cleanup
- **Sync: Merge uses strict `>`** — `remote.updatedAt > local.updatedAt` means equal timestamps keep the local version. Deletion markers always win regardless of timestamps

## CI & PR conventions

- GitHub Actions runs lint + build on every push to `main` and on all PRs (Node 22, ubuntu-latest)
- Releases triggered by `v*` tags
- Version tracked in `package.json` and `CHANGELOG.md` (Keep a Changelog format)
- Keep PRs focused on a single concern
- Update `CHANGELOG.md` under `[Unreleased]` for user-facing changes
- See @CONTRIBUTING.md for development setup
