<p align="center">
  <img src="public/logo.svg" alt="WorkLedger" width="64">
</p>

<h1 align="center">WorkLedger</h1>

<p align="center">An open-source engineering notebook for documenting your daily work.<br>Built with React, BlockNote, and Excalidraw.</p>

<p align="center">
  <img src="landing/images/product.png" alt="WorkLedger" width="720">
</p>

## Features

- **Daily entries** -- Organized by day with timestamps, create entries with `Cmd+J`
- **Rich text editing** -- Powered by [BlockNote](https://blocknotejs.org/) with slash commands for headings, lists, code blocks, and more
- **Inline drawings** -- Embed [Excalidraw](https://excalidraw.com/) diagrams directly in your notes via `/drawing`
- **Tagging** -- Tag entries for easy categorization and filtering
- **Search** -- Full-text search across all entries and tags (`Cmd+K`)
- **Sidebar filtering** -- Click a tag or type to filter entries in real-time
- **Archive & restore** -- Archive old entries to keep your workspace clean, browse and restore them anytime
- **Import & export** -- Export all entries as JSON for backup, import them back anytime
- **Local-first** -- All data stored in IndexedDB, no server required
- **Keyboard-driven** -- `Cmd+J` new entry, `Cmd+K` search, `Cmd+\` toggle sidebar, `Escape` clear filter

### Optional: Think with AI (v1.1)

An optional AI sidebar with 10 structured thinking frameworks. Off by default, zero impact on the core app when disabled.

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
  <img src="landing/images/ai/note_conversation.png" alt="AI thinking sidebar" width="720">
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
