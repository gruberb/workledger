# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [3.2.3] - 2026-02-19

### Fixed

- Scroll jitter near bottom of entry list when browser chrome toggles — added 500ms debounce before unmounting editors so transient boundary oscillation from viewport resizing is absorbed
- Mobile scroll jitter caused by viewport chrome resizing — switched `useNearViewport` rootMargin from percentage-based (`200%`) to fixed pixels (`2000px`) so browser toolbar show/hide no longer toggles entries between editor and placeholder

## [3.2.1] - 2026-02-19

### Changed

- Lazy-mount BlockNote editors based on viewport proximity — only entries within ~2 viewport heights get a live editor; far-away entries render a lightweight title/preview placeholder, reducing live `useSyncExternalStore` subscribers from ~40 to ~5-8 and eliminating scroll jiggle during backlink navigation

### Fixed

- Imported entries now build backlinks index — wiki-links in imported entries generate "Referenced by" panels immediately instead of requiring a manual edit to each entry
- Focus mode now scrolls to the top when entering, so the focused entry is fully visible
- Exiting focus mode no longer flashes to the top before scrolling back — scroll restore runs before paint via `useLayoutEffect`
- Exiting focus mode no longer collapses all entries to placeholders — `useNearViewport` ignores `IntersectionObserver` callbacks fired while the list is hidden with `display: none`
- Scrollbar no longer jitters during scrolling — placeholders now preserve the measured height of the editor they replace instead of using a fixed 80px minimum
- Background content no longer scrolls when the mobile sidebar is open

## [3.2.0] - 2026-02-18

### Fixed

- BacklinksPanel no longer floods IndexedDB on every autosave — re-fetches only when a known source changes or a new backlink is detected (debounced)
- EntryStream uses progressive rendering when large numbers of entries appear at once (e.g. clearing filters), eliminating UI jank
- Exiting focus mode is now instant — entry list is hidden via CSS instead of unmounted, avoiding remount of all editors

## [3.1.0] - 2026-02-18

### Fixed

- Performance improvements — reduced unnecessary re-renders across the app
  - DayHeader wrapped in `React.memo` (was the #1 offender at 1,530 re-renders)
  - Sidebar collapse handlers converted to `useCallback` (162 re-renders)
  - Search open handler in App.tsx converted to `useCallback` (58 re-renders)
  - SearchPanel, NewEntryButton, and BacklinksPanel wrapped in `React.memo`
  - Context values memoized (AIContext, FocusModeContext)
  - AppContent handlers wrapped in `useCallback`

## [3.0.2] - 2026-02-18

### Fixed

- Backlinks "Referenced by" panel now updates live when a `[[link]]` is created — no longer requires a page reload
- `[[` entry link suggestion menu now works on mobile keyboards (replaced `keydown` with `input` event)
- Clicking a backlink now scrolls to the entry's heading instead of the toolbar row

## [3.0.1] - 2026-02-18

### Added

- End of Day template — brain dump template with sections for Done Today, In Progress, Blocked, Tomorrow's Priorities, Follow-ups, Meetings, To Review, and Brain Dump; auto-tagged `#eod`

### Changed

- Reworked entry signifiers — replaced Note/Decision/Task/Question/Idea with Decision/Question/Idea/Milestone. "Note" was redundant (every entry is a note) and "Task" belongs in a task tracker. New "Milestone" signifier marks accomplishments for brag docs and performance reviews. Signifiers are now optional highlights, not mandatory categories.
- Updated landing page and README to reflect new template and signifier changes

## [3.0.0] - 2026-02-17

### Added

- Entry templates — create entries pre-filled with structured sections via dropdown on the New Entry button
  - Decision Log (Context / Decision / Consequences) with auto-tag `#decision`
  - Debugging Session (Problem / Hypothesis / Steps Tried / Solution) with auto-tag `#debugging`
  - Meeting Notes (Attendees / Discussion / Action Items) with auto-tag `#meeting`
  - Learning Log (What I Learned / Source / How to Apply) with auto-tag `#learning`
- Saved filters — save the current tag + text filter combination as a named quick-access filter in the sidebar
- Pin entries — pin icon on entry cards to keep important entries at the top in a dedicated "Pinned" section above day groups
- Entry signifiers — optional colored label (Note, Decision, Task, Question, Idea) on each entry; click the dot in the header to pick; filter by signifier in the sidebar
- Backlinks panel — "Referenced by" section below each entry showing all entries that link to it via `[[` wiki-links; auto-maintained on save
- AI Notebook Companion — replaced 10 thinking frameworks with 12 concrete engineer actions organized by category:
  - **Summarize:** My Day, My Week, A Topic
  - **Generate:** Standup Update, PR Description, ADR from Notes, Draft Message
  - **Think:** Rubber Duck, Challenge My Thinking, Explore Tradeoffs
  - **Remember:** What Did I Decide About...?, When Did I Last Work On...?
  - Actions support multi-entry context (day/week/topic scope) and topic search
- Weekly review — toggle in sidebar settings groups entries by ISO week with entry count, top tags, signifier breakdown, and clickable entry titles
  - Human-readable week labels ("This Week", "Last Week", "Week of Feb 10")
  - Collapsible week cards — most recent auto-expanded, older weeks collapsed
  - Entry previews and pinned entry highlighting in review list
  - Filtering (text, tags, signifiers, saved filters) works in review mode
  - Click entries to navigate and scroll to them in the main stream
  - Optional "Summarize with AI" link per week card (when AI is enabled)
- Landing page updated with all new features and 12 AI actions

### Removed

- 10 academic thinking frameworks (Thinker's Toolkit, First Principles, Six Thinking Hats, TRIZ, Design Thinking, Socratic Method, Systems Thinking, Lateral Thinking, OODA Loop, Theory of Constraints) — replaced by concrete AI actions above

## [2.2.3] - 2026-02-15

### Fixed

- Editor now applies synced content updates in-place — previously, editing an entry on another device would write to IndexedDB but the BlockNote editor kept showing stale content until a hard refresh
- Memoize EntriesContext and SyncContext provider values, preventing cascading re-renders that caused pull requests to accelerate from every 30s to ~1/s
- Zod validation for synced entries now defaults `blocks`, `isArchived`, and `tags` instead of rejecting entries missing those fields
- Refresh UI on all new entries received from the server, not just those that were merged as newer
- Prevent infinite pagination loops when pull cursor fails to advance
- Fix sync race condition where pull and push could overlap via mutex guard

## [2.2.2] - 2026-02-15

### Fixed

- CSP now allows WebAssembly (`wasm-unsafe-eval`) for crypto/Excalidraw and Google Fonts for Excalidraw font loading
- CSP now allows `unsafe-eval` for bundled library usage, deploy-injected analytics script and inline script hashes
- "Sync now" resets the pull cursor to 0, forcing a full re-pull that recovers entries skipped by the old cursor-advancement bug
- "Sync now" cursor reset is now visible to the pull immediately — fixes race where React state update hadn't flushed before pull() read the ref, causing entries to appear only after hard refresh

## [2.2.1] - 2026-02-15

### Fixed

- Integrity hash now computed on JSON plaintext instead of sortedStringify, fixing hash mismatch on entries with undefined values after JSON round-trip
- Hash mismatch on decrypt downgraded from rejection to warning — AES-256-GCM already guarantees authenticity, so old-format entries are accepted and corrected on next push
- Push handler no longer advances the pull cursor, preventing skipped entries when syncNow() runs push before pull
- Pull cursor only advances past successfully processed entries — failed entries are re-fetched on next pull instead of silently skipped forever
- syncNow() now pulls before pushing to avoid cursor jumps
- Silent catch blocks in sync-operations, merge, and useSync now log entry IDs and error messages

## [2.2.0] - 2026-02-14

### Added

- Content Security Policy meta tag — restricts script, style, connect, and worker sources
- SVG sanitization via DOMPurify for all Excalidraw preview rendering (`dangerouslySetInnerHTML`)
- Zod schema validation for imported JSON files and synced remote entries — malformed entries are skipped gracefully
- AI provider URL validation — rejects non-http/https protocols in Ollama and custom server constructors
- Helper text warnings for API key storage ("Stored unencrypted in this browser") under HuggingFace and custom server key inputs
- HTTP warning when Ollama or custom server URL points to a non-localhost HTTP endpoint
- Disconnect helper text explaining that the server account is preserved
- New dependencies: `zod`, `dompurify`, `@types/dompurify`

### Changed

- Sync ID warnings rewritten: emphasize it's the encryption key and should be saved in a password manager
- SECURITY.md rewritten with per-mode data handling documentation (local, sync, AI)
- Import result now reports invalid entry count alongside imported/skipped

## [2.1.3] - 2026-02-14

### Fixed

- New Entry button no longer overlaps the AI sidebar — shifts left when the sidebar is open
- Focus mode exit now restores scroll position to the previously focused entry
- Focus mode exit feels instant instead of ~1s delay (uses instant scroll instead of smooth)

### Added

- Sidebar auto-highlights the current day section as you scroll through entries

## [2.1.2] - 2026-02-14

### Added

- App-level error boundary — unexpected crashes show a recovery screen instead of a blank page
- Editor-level error boundary — a failed editor no longer takes down the entire app
- Unit tests for sync crypto, integrity hashing, and entry encryption/decryption (30 tests via vitest)
- Typed event bus (`src/utils/events.ts`) replaces untyped `window.dispatchEvent(CustomEvent)` calls across features
- Shared icon components (`Icons.tsx`) for archive, trash, check, AI, search, settings, chevron, and close icons
- Accessibility: focus trap on search panel, `role`/`aria-expanded`/`aria-haspopup` on settings dropdown, `aria-label` on all icon-only buttons

### Changed

- Split `SidebarContext` into three focused contexts (`useSidebarUI`, `useSidebarFilter`, `useSidebarData`) to reduce unnecessary re-renders
- `Sidebar` component now consumes its own contexts directly — reduced from 22 props to 2
- Extracted sync encryption/decryption into `sync-crypto.ts` and push/pull operations into `sync-operations.ts`
- Deduplicated entry filtering logic into shared `filterEntries()` utility with pluggable text matcher
- Moved Excalidraw global styles from module-level DOM injection to lazy `ensureStyles()` on first render
- Sync now performs an initial pull immediately on connect instead of waiting for the first 30-second interval

## [2.1.1] - 2026-02-14

### Fixed

- "Delete all entries" now syncs deletions to other devices by sending tombstones for each entry

## [2.1.0] - 2026-02-14

### Added

- "Delete account" button in Storage settings with confirmation step — permanently removes server account and all synced entries
- Connected view now always shows the server endpoint URL

### Changed

- "Delete all entries" no longer deletes the server sync account — only clears local IndexedDB entries
- "Disconnect" button restyled as neutral (no longer red) to distinguish from destructive "Delete account"

## [2.0.3] - 2026-02-14

### Fixed

- "Sync now" button force-pushes all local entries to catch previously unsynced data
- PWA service worker now auto-updates instead of waiting for a prompt that never appeared

## [2.0.2] - 2026-02-14

### Fixed

- Background push uses dirty entry tracking instead of timestamp comparison — entries edited between pull cycles are no longer missed
- Background push retries when blocked by an in-progress pull instead of silently dropping

## [2.0.0] - 2026-02-14

### Added

- **End-to-end encrypted sync** — sync entries across devices with client-side encryption
  - Generate a sync ID or connect to an existing one
  - All entries encrypted before leaving the browser
  - Configurable server endpoint — use the default server or [self-host your own](https://github.com/gruberb/workledger-sync)
  - Sync status indicator with last sync timestamp
  - Manual "Sync now" button and automatic background sync
  - Disconnect preserves local data
- Multi-theme system with 5 presets: Default Light, Default Dark, Dracula, Catppuccin Mocha, Solarized Light
- Independent editor font selection: Figtree, Plus Jakarta Sans, DM Sans, Urbanist, Inter, JetBrains Mono, Source Serif 4
- Theme and font settings accessible via submenus in the settings dropdown
- Sidebar accent colors now follow the active theme
- BlockNote editor menus fully themed to match active palette
- URL hash anchors — navigating to an entry updates the URL to `#entry-<id>`, enabling bookmarks and link sharing
  - Hash is read on page load to scroll to the referenced entry
  - Browser back/forward navigation works via `hashchange` listener
- Focus mode — click the expand icon on any entry to view it full-screen
  - Distraction-free single-entry view with back button and entry timestamp
  - Press `Esc` or click the back arrow to return to the stream
  - URL hash updates in focus mode for bookmarkable focused views
- Progressive Web App (PWA) support — install WorkLedger as a standalone app
  - Auto-updating service worker caches all assets for offline use
  - Web app manifest with app name, theme color, and icons
  - Apple mobile web app meta tags for iOS home screen support
  - SVG icons (192x192 and 512x512) derived from the existing logo
- Mobile-friendly responsive layout for screens under 768px
  - Sidebar becomes a full-screen overlay with backdrop on mobile
  - Sidebar auto-closes on mobile after day click or search open
  - Entry action buttons (archive, delete, AI) always visible on small screens (no hover required)
  - Touch-based resize handles for Excalidraw drawings with larger touch targets
  - `useIsMobile` hook for responsive behavior across components
- README badges for license, build status, TypeScript, React, and local-first

### Changed

- Editor body font size reduced to 16px for tighter content
- Code block font size set to 14px for better density
- Sidebar day list font size reduced to 14px for tighter fit
- Entry spacing between day sections reduced
- Day headers, filter banners, and focus headers use theme-aware colors
- Settings dropdown items reordered: Archive, AI, Theme, Font, Export, Import, Delete
- AppShell removes sidebar padding on mobile since sidebars overlay instead of push content
- Reduced horizontal padding from 48px to 16px on mobile for better space usage
- Excalidraw default canvas height reduced to 350px on mobile (from 500px)
- Excalidraw minimum width lowered to 200px (from 300px)
- Excalidraw preview SVG max-height reduced to 280px on mobile
- Sidebar toggle button now has visible background and border in all themes
- Landing page sync feature promoted from "Coming Soon" to full feature

### Fixed

- Theme switching now updates code blocks, Excalidraw, and font colors without page refresh
- BlockNote menus (formatting toolbar, color picker) now appear above sidebar and sticky headers
- Cmd+K search shortcut now works reliably (fixed dual useSearch instance bug)
- Fixed pre-existing feature boundary violation in EntryCard import
- Exiting focus mode is now instant (removed unnecessary fade-in animation on entry stream restore)

### Removed

- AI lightbulb buttons hidden on mobile viewports (AI sidebar returns null on mobile)
- Removed entry card fade-in animation (caused sluggish exit from focus mode)

## [1.1.4] - 2026-02-13

### Fixed

- Code block background now respects light/dark mode instead of always being dark
- Language selector dropdown visible in light mode

## [1.1.3] - 2026-02-13

### Added

- Syntax highlighting for code blocks with language selection dropdown (24 languages)
  - Powered by Shiki with CSS variable theme that adapts to light/dark mode
  - Languages loaded on demand for minimal bundle impact
  - Use `/code` slash command to insert a code block

## [1.1.2] - 2026-02-13

### Added

- Dark mode with moon/sun toggle in sidebar settings dropdown
  - Defaults to system preference, persists user choice in IndexedDB
  - Flash-free initial load via localStorage mirror and inline script
  - CSS variables for scrollbar, AI markdown, and streaming cursor adapt automatically
  - Tailwind `dark:` variants across all 19 component files
  - BlockNote editor and Excalidraw drawings render in correct theme
  - Excalidraw preview uses CSS `invert()` filter for seamless dark adaptation
  - Tag colors have dark mode variants with reduced opacity backgrounds
  - Search panel, AI sidebar, and all modals properly themed

### Changed

- Expanded CSS theme variables: added `--color-notebook-surface`, `--color-notebook-surface-alt`, `--color-notebook-muted`, `--color-notebook-border`, `--color-notebook-code-bg`, `--color-notebook-scrollbar`
- Replaced hardcoded hex colors in `app.css` with CSS variable references
- Replaced hardcoded `bg-[#fafafa]` / `text-[#1a1a1a]` in AppShell and DayHeader with CSS variables

## [1.1.1] - 2026-02-12

### Changed

- Extracted shared SSE stream parser for HuggingFace and Custom Server providers
- Extracted `ConfirmAction` component in EntryCard to reduce duplication
- Extracted resize handler factory in ExcalidrawBlock
- Extracted `SidebarSettings` component from Sidebar
- Replaced `Promise.resolve().then()` anti-pattern with derived state in hooks
- Fixed hook dependency arrays in AISidebar
- Improved error type guard in useAIConversation

### Removed

- Dead code: unused `useCurrentDay` hook, `getLast30DayKeys`, `getFrameworksByCategory`, `getConversation`, `deleteConversation`
- Removed `process.env.IS_PREACT` define from Vite config
- Removed version callouts from README and landing page copy

### Fixed

- Type safety: removed unnecessary type casts in App and ai-settings
- Added try-catch around JSON.parse in Ollama streaming
- Added `data-1p-ignore` to inputs to prevent 1Password autofill popups
- Renamed `checking` to `loading` in useAIFeatureGate for consistency

## [1.1.0] - 2026-02-12

### Added

- Optional AI thinking sidebar with 10 structured frameworks
  - The Thinker's Toolkit, First Principles, Six Thinking Hats, TRIZ, Design Thinking, Socratic Method, Systems Thinking, Lateral Thinking, OODA Loop, Theory of Constraints
- Three AI provider options: Ollama (local), Hugging Face (remote), Custom OpenAI-compatible server
- Lightbulb icon on note cards to open AI sidebar with that note's content
- Streaming responses with markdown rendering
- Follow-up suggestions and step navigation within each framework
- Conversation persistence in IndexedDB
- AI setup guide with connection testing
- AI settings panel (provider, model, temperature, max tokens)
- Feature-gated behind settings toggle -- off by default
- `Cmd+Shift+I` keyboard shortcut to toggle AI sidebar
- Responsive auto-collapse of left sidebar when both sidebars are open
- Landing page AI section with framework details
- New dependencies: `react-markdown`, `remark-gfm`

## [1.0.0] - 2026-02-12

### Added

- Daily entries organized by day with timestamps
- Rich text editing powered by BlockNote with slash commands
- Inline Excalidraw drawings via `/drawing` command
- Tagging system for entry categorization and filtering
- Full-text search across all entries and tags (`Cmd+K`)
- Sidebar filtering by tag or type
- Archive and restore functionality
- Import/export entries as JSON
- Wiki-style `[[links]]` between entries
- Keyboard shortcuts: `Cmd+J` (new entry), `Cmd+K` (search), `Cmd+\` (sidebar)
- Local-first storage with IndexedDB -- no server required
- Landing page

[3.1.0]: https://github.com/gruberb/workledger/releases/tag/v3.1.0
[3.0.2]: https://github.com/gruberb/workledger/releases/tag/v3.0.2
[3.0.1]: https://github.com/gruberb/workledger/releases/tag/v3.0.1
[3.0.0]: https://github.com/gruberb/workledger/releases/tag/v3.0.0
[2.2.3]: https://github.com/gruberb/workledger/releases/tag/v2.2.3
[2.2.2]: https://github.com/gruberb/workledger/releases/tag/v2.2.2
[2.2.1]: https://github.com/gruberb/workledger/releases/tag/v2.2.1
[2.2.0]: https://github.com/gruberb/workledger/releases/tag/v2.2.0
[2.1.3]: https://github.com/gruberb/workledger/releases/tag/v2.1.3
[2.1.2]: https://github.com/gruberb/workledger/releases/tag/v2.1.2
[2.1.1]: https://github.com/gruberb/workledger/releases/tag/v2.1.1
[2.1.0]: https://github.com/gruberb/workledger/releases/tag/v2.1.0
[2.0.3]: https://github.com/gruberb/workledger/releases/tag/v2.0.3
[2.0.2]: https://github.com/gruberb/workledger/releases/tag/v2.0.2
[2.0.1]: https://github.com/gruberb/workledger/releases/tag/v2.0.1
[2.0.0]: https://github.com/gruberb/workledger/releases/tag/v2.0.0
[1.1.4]: https://github.com/gruberb/workledger/releases/tag/v1.1.4
[1.1.3]: https://github.com/gruberb/workledger/releases/tag/v1.1.3
[1.1.2]: https://github.com/gruberb/workledger/releases/tag/v1.1.2
[1.1.1]: https://github.com/gruberb/workledger/releases/tag/v1.1.1
[1.1.0]: https://github.com/gruberb/workledger/releases/tag/v1.1.0
[1.0.0]: https://github.com/gruberb/workledger/releases/tag/v1.0.0
