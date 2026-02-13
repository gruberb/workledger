# WorkLedger

Local-first engineering notebook — React + TypeScript, all data in IndexedDB, no server.

## Commands

```bash
npm run dev        # Vite dev server (localhost:5173)
npm run build      # TypeScript check (tsc -b) + Vite production build
npm run lint       # ESLint (flat config)
npm run preview    # Preview production build
```

IMPORTANT: Always run `npm run lint` and `npm run build` after making changes to verify correctness. There is no test suite — the build and lint are the primary verification steps.

## Code style

- ES modules (`import/export`), never CommonJS
- Strict TypeScript (`strict: true`, `noUnusedLocals`, `noUnusedParameters`)
- Functional components with hooks only — no class components
- Tailwind CSS utility-first for styling; custom theme variables prefixed `--color-notebook-*` in `src/app.css`
- Props interfaces defined directly above their component, not in separate type files
- Event handlers prefixed with `handle` (e.g., `handleNewEntry`, `handleDeleteEntry`)

## Architecture

- **Hooks for state** — no external state management library. Each feature area has its own hook in `src/hooks/`
- **Storage layer** (`src/storage/`) wraps IndexedDB via `idb` — all DB operations go through this layer, never direct IndexedDB access from components
- **AI feature is fully optional** — gated by settings toggle and `useAIFeatureGate` hook. All AI code lives in `src/ai/` and `src/components/ai/`. It can be removed without affecting core functionality
- **Custom BlockNote schema** — extended with `excalidraw` block type and `entryLink` inline content. Schema is defined in `src/components/editor/EditorProvider.tsx`
- **Cross-entry navigation** uses custom DOM event `workledger:navigate-entry`, dispatched from links and handled in `App.tsx`

## Common gotchas

- The search index is a **separate IndexedDB store** from entries — it must be updated whenever entries are saved (handled by `useAutoSave` hook)
- Excalidraw is wrapped in an error boundary (`ExcalidrawBlock.tsx`) — drawing errors should not crash the app
- Debounce timings: auto-save is 500ms, search is 200ms, sidebar filter is 200ms
- Vite config has specific dependency optimizations for Excalidraw and PNG chunk libraries — don't remove these without testing
- The `landing/` directory is a separate static site, not part of the React app

## CI

- GitHub Actions runs lint + build on every push to `main` and on all PRs (Node 22, ubuntu-latest)
- Releases triggered by `v*` tags — creates GitHub release with auto-generated notes
- Version is tracked in `package.json` and `CHANGELOG.md` (Keep a Changelog format)

## PR conventions

- Keep PRs focused on a single concern
- Update `CHANGELOG.md` under `[Unreleased]` for user-facing changes
- See @CONTRIBUTING.md for development setup and guidelines
