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
  <img src="landing/images/product.png" alt="WorkLedger" width="720">
</p>

## Features

### Customize your workspace

- **5 theme presets** -- Light, Dark, Dracula, Catppuccin Mocha, and Solarized Light — each adapts the entire UI including syntax highlighting
- **7 font families** -- Figtree, Plus Jakarta Sans, DM Sans, Urbanist, Inter, JetBrains Mono, or Source Serif
- **Focus mode** -- Full-screen, distraction-free writing on a single entry
- **Progressive Web App** -- Install as a standalone app on any device, works offline

### Write and organize

- **Daily entries** -- Organized by day with timestamps, create entries with `Cmd+J`
- **Rich text editing** -- Powered by [BlockNote](https://blocknotejs.org/) with slash commands for headings, lists, code blocks, and more
- **Inline drawings** -- Embed [Excalidraw](https://excalidraw.com/) diagrams directly in your notes via `/drawing`
- **Syntax highlighting** -- 24 languages with Shiki, theme-aware code blocks
- **Wiki-style linking** -- Type `[[` to link between entries and build a knowledge graph
- **Tagging** -- Color-coded tags for categorization and filtering
- **Search** -- Full-text search across all entries and tags (`Cmd+K`)

### Stay in control

- **Local-first** -- All data stored in IndexedDB, no server required
- **Optional server sync** -- End-to-end encrypted sync across devices. Use the default server or [self-host your own](https://github.com/gruberb/workledger-sync) — generate a sync ID, and your entries are encrypted before leaving the browser
- **Import & export** -- Export all entries as JSON for backup, import them back anytime
- **Archive & restore** -- Archive old entries to keep your workspace clean, browse and restore them anytime
- **Mobile-friendly** -- Responsive layout with touch-friendly controls
- **Keyboard-driven** -- `Cmd+J` new entry, `Cmd+K` search, `Cmd+\` toggle sidebar, `Escape` clear filter

### Optional: Think with AI

An optional AI sidebar with 10 structured thinking frameworks. Off by default, zero impact on the core app when disabled. Easy to remove if unwanted — fork and delete the `src/ai/` and `src/components/ai/` directories without affecting anything else.

**Quick start:**

1. Click the **gear icon** in the left sidebar and select **Enable AI**
2. **Configure a provider** — choose one:
   - **Ollama (local):** Install [Ollama](https://ollama.com/), run `ollama pull mistral`, done
   - **Hugging Face (remote):** Paste a free [API token](https://huggingface.co/settings/tokens) and pick a model
   - **Custom server:** Point to any OpenAI-compatible endpoint
3. Hover over a note and click the **lightbulb icon**
4. **Pick a thinking framework** and the AI applies it to your note

**10 frameworks included:** The Thinker's Toolkit, First Principles, Six Thinking Hats, TRIZ, Design Thinking, Socratic Method, Systems Thinking, Lateral Thinking, OODA Loop, Theory of Constraints

<p align="center">
  <img src="landing/images/ai/ai_in_action.png" alt="AI thinking sidebar" width="720">
</p>

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
