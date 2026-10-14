<p align="center">
  <img src="public/logo.svg" alt="WorkLedger" width="64">
</p>

<h1 align="center">WorkLedger</h1>

<p align="center">An open-source engineering notebook for documenting your daily work.<br>Built with React, BlockNote, and Excalidraw.</p>

<p align="center">
  <a href="https://github.com/gruberb/workledger/blob/main/LICENSE">
    <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg" />
  </a>
  <a href="https://github.com/gruberb/workledger/actions">
    <img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/gruberb/workledger/ci.yml?branch=main" />
  </a>
  <a href="https://github.com/gruberb/workledger/blob/main/CONTRIBUTING.md">
    <img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" />
  </a>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" />
  <img alt="Local-first" src="https://img.shields.io/badge/local--first-IndexedDB-orange" />
</p>

<p align="center">
  <img src="docs/images/product.png" alt="WorkLedger" width="720">
</p>

## Features

### Customize your workspace

- **6 theme presets**: Paper, Ink, Nord Aurora, Nord Polar Night, High Contrast Light, and High Contrast Dark. Retired light themes migrate to Paper; Dracula and Catppuccin Mocha migrate to Ink.
- **7 font families** -- Figtree, Plus Jakarta Sans, DM Sans, Urbanist, Inter, JetBrains Mono, or Source Serif 4
- **Focus mode** -- Full-screen, distraction-free writing on a single entry
- **Progressive Web App** -- Install as a standalone app on any device, works offline

### Write and organize

- **Daily entries** -- Organized by day with timestamps, create entries with `Cmd+J`
- **Rich text editing** -- Powered by [BlockNote](https://blocknotejs.org/) with slash commands for headings, lists, code blocks, and more
- **Inline drawings** -- Embed [Excalidraw](https://excalidraw.com/) diagrams directly in your notes via `/drawing`
- **Syntax highlighting** -- 24 languages with Shiki, theme-aware code blocks
- **Wiki-style linking** -- Type `[[` to link between entries and build a knowledge graph
- **Backlinks** -- "Referenced by" panel below each entry shows all entries that link to it, auto-maintained on save
- **Entry templates** -- Start entries with structured sections: RFD (brief and full), Decision Log, Debugging Session, Meeting Notes, Learning Log, and End of Day, each with pre-filled headings and auto-tags or signifiers
- **Entry signifiers** -- Label entries as Decision, Question, Idea, Milestone, Small win, or RFD with color-coded indicators; filterable in the sidebar. Most entries need no signifier; use them to highlight what matters
- **RFDs** -- Write RFDs (Requests for Discussion) as entries: start from the brief or full RFD template and delete the sections you don't need. Tag each RFD with its project, then filter by the RFD signifier plus the project tag (and save the filter) to see every RFD of a project. Link RFDs from daily notes with `[[`, and the RFD's "Referenced by" panel shows its history
- **Pin entries** -- Pin important entries to the top of your stream
- **Tagging** -- Color-coded tags for categorization and filtering
- **Saved filters** -- Select tags or signifiers, then use Save current filter in the sidebar to name the combination for one-click access. Tags and signifiers from all entries are listed, not only recent ones
- **Search** -- Full-text search across all entries and tags (`Cmd+K`)

### Review your work

- **Weekly review** -- Select an ISO week to see signifier breakdowns, top tags, and entry previews
- **Collapsible week cards** -- Most recent week auto-expanded, older weeks collapsed
- **Filtering in review mode** -- Tag, signifier, and saved filters work in the weekly view; full-text search is available separately

### Stay in control

- **Local-first** -- All data stored in IndexedDB, no server required
- **Optional server sync** -- End-to-end encrypted sync across devices. Use the default server or [self-host your own](https://github.com/gruberb/workledger-sync) — generate a sync ID, and your entries are encrypted before leaving the browser
- **Import & export** -- Export all entries as JSON for backup, import them back anytime, or import a Logseq graph (see [Importing](#importing)). Download a single entry as Markdown from its toolbar, e.g. to hand it to a local LLM
- **Archive & restore** -- Archive old entries to keep your workspace clean, browse and restore them anytime
- **Mobile-friendly** -- Responsive layout with touch-friendly controls
- **Keyboard-driven** -- `Cmd+J` new entry, `Cmd+K` search, `Cmd+\` toggle sidebar, `Escape` clear filter

### Optional: AI Notebook Companion

An optional AI sidebar with 16 concrete engineer actions, including web research with cited sources. Off by default, zero impact on the core app when disabled. Easy to remove if unwanted — fork and delete `src/features/ai/` without affecting anything else.

**Quick start:**

1. Click **Settings** in the left sidebar and select **Enable AI**
2. **Configure a provider** — choose one:
   - **Ollama (local):** Install [Ollama](https://ollama.com/), start its server, then run `ollama pull mistral`. Check `http://localhost:11434/api/tags` if the app says disconnected. If WorkLedger is served from another origin, allow that origin with Ollama's `OLLAMA_ORIGINS` setting
   - **Anthropic, OpenAI or OpenRouter (bring your own key):** Paste an API key. The default models are `claude-opus-5-5`, `gpt-5` and `openrouter/auto`. These three support web search
   - **Hugging Face (remote):** Paste a free [API token](https://huggingface.co/settings/tokens) and pick a model
   - **Custom server:** Point to any OpenAI-compatible endpoint

   Keys are stored unencrypted in this browser's IndexedDB, and requests go straight from the browser to the provider.
3. Click **Think with AI** above a note
4. **Pick an action** from 5 categories:

| Category | Actions |
|----------|---------|
| **Research** | Ask / Research (free-form, uses web search), Research an Unknown (the open questions of an RFD) |
| **Summarize** | My Day, My Week, A Topic |
| **Generate** | Standup Update, PR Description, ADR from Notes, Draft RFD from Notes, Draft Message |
| **Think** | Rubber Duck, Challenge My Thinking, Critique this RFD, Explore Tradeoffs |
| **Remember** | What Did I Decide About...?, When Did I Last Work On...? |

Actions support multi-entry context (day, week, or topic scope) and topic search. With web search enabled (AI settings), research answers list their sources; the provider bills each search.

<p align="center">
  <img src="docs/images/ai/ai_in_action.png" alt="AI notebook companion" width="720">
</p>

## Importing

Both imports are in the **gear menu** in the left sidebar. Importing never overwrites a newer version of an entry, so it is safe to run again.

### WorkLedger JSON

**Import entries** takes the file written by **Export entries**:

```json
{
  "version": 1,
  "exportedAt": "2026-10-11T12:00:00.000Z",
  "entryCount": 1,
  "entries": [
    {
      "id": "3f2b...",
      "dayKey": "2026-10-11",
      "createdAt": 1760184000000,
      "updatedAt": 1760184000000,
      "blocks": [],
      "isArchived": false,
      "tags": ["work"],
      "isPinned": false
    }
  ]
}
```

`blocks` is the [BlockNote](https://www.blocknotejs.org/) document. Entries that fail validation are counted as invalid and skipped.

### Logseq

**Import from Logseq** asks for your graph folder (the one containing `journals/` and `pages/`). Everything is converted in the browser; nothing is uploaded.

| Logseq | WorkLedger |
|--------|------------|
| Journal `journals/2024_06_15.md` | Entry on June 15, 2024 |
| Page `pages/Project X.md` | Entry on the file's last-modified day, titled "Project X" |
| Nested bullets | Nested list items |
| `TODO` / `DOING` / `LATER` / `NOW`, `DONE`, `CANCELED` | Checklist items (open, checked, checked and struck through) |
| `[[Page]]`, `[label]([[Page]])`, `{{embed [[Page]]}}` | Entry links (plain text if the page has no file) |
| `#tag`, `#[[multi word]]`, `tags::` | Entry tags |
| `title::`, `alias::` | Entry title, extra names for links |
| `((block-ref))`, `{{embed ((block-ref))}}` | The referenced block's text |
| Other `{{macros}}` (queries, renderers) | Shown as inline code |
| Other `key:: value` properties | Dropped |
| Local images from `assets/` | Not imported (a note marks where they were) |

Re-importing the same graph updates the entries it created earlier; entries you have edited in WorkLedger since then are kept. Journal file names must use Logseq's default `yyyy_MM_dd` format.

## Getting Started

```bash
git clone https://github.com/gruberb/workledger.git
cd workledger
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## License

MIT
