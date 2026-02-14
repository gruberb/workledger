# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
