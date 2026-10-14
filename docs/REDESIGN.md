# WorkLedger redesign plan

Adopt a **graphic field notebook** identity: warm paper, dark ink, clear borders, friendly typography, and small colorful icons. Give the landing page and app the same visual vocabulary, with a quieter writing surface inside the app.

Status: proposed direction, 14 October 2026. Scope: `workledger` and `../workledger-landing`. This document specifies the redesign; it does not change the running app.

## Revision following mockup review

The 14 October review changes the app direction to a wide, open canvas. Keep the proposed palette and font families, but use quieter separators and less framing inside the notebook. Create entries directly in the document flow, with no required title, boxed composer, or submit action. Preserve the production editor's free-form blocks and autosave behavior.

Remove the daily prompt banner and motivational header copy. Keep dates, entry metadata, and actions simple. Align the Focus and Entry actions controls on one baseline; anchor a modest, content-sized dropdown directly below its trigger.

The sidebar entry is Settings, with the current AI, theme, note font, storage, Logseq import, export, import, and delete controls. Appearance is part of Settings. In the HTML mockup, storage and import/delete operations are labeled previews and do not access real data.

The landing hero uses Figtree throughout, with no cursive emphasis and no tagline above it. These revisions supersede the narrower writing column, daily prompt, and serif hero treatment proposed below.

## 1 Intent and current problems

WorkLedger should feel like a personal notebook worth opening every day. The main experience is recording work, finding earlier thinking, and reviewing what happened. Personal character should come from typography, color, and thoughtful details, while the user's writing remains the most prominent content.

The current implementation has several sources of inconsistency:

| Observation | Consequence | Change |
| --- | --- | --- |
| App CSS imports Archivo and Playfair Display, uses system UI text, and offers seven editor fonts | Typography lacks one clear identity | Use three named families with fixed roles |
| Landing page loads Playfair Display, Source Serif 4, DM Sans, and JetBrains Mono | Marketing and app feel related only loosely | Share typography, colors, logo, and control shapes |
| Entry actions use `opacity-0 group-hover:opacity-100` | Features depend on discovering hover behavior | Persistent, labeled action controls |
| First-use screen displays a large notebook emoji and pale instructions | Generic appearance and an indirect path into writing | Remove the emoji and place a real writing action in the empty state |
| Sidebar provides Journal, Weekly review, and Archive, while header controls are mainly circular icons | Navigation is partly explicit, partly symbolic | Keep the view labels and make primary actions equally explicit |
| Landing page contains a large feature inventory and a substantial AI section | The everyday notebook promise competes with secondary capabilities | Organize the page around capture, recall, and review |
| Existing logo and favicon have fine page lines | Small-size identity depends on details that can disappear | Simplify to a bold cover, spine, and bookmark |

Evidence: `src/app.css`, `src/features/theme/`, `src/features/entries/components/EmptyStates.tsx`, `EntryToolbar.tsx`, `src/app/components/AppHeader.tsx`, `src/features/sidebar/utils/views.tsx`, `public/`, and `../workledger-landing/index.html`. The checked-in product screenshot illustrates the earlier visual identity; current source is the basis for behavior observations.

### Outcomes

- A new visitor can explain what WorkLedger does and start an entry without an account setup detour.
- A returning user can create an entry, find a previous note, and open weekly review through visible controls.
- Landing page, desktop app, mobile app, empty states, and installed app icons visibly belong together.
- Personalization changes reading comfort without changing the identity of every control.
- Local storage, autosave, optional sync, exports, keyboard shortcuts, and optional AI retain their existing behavior.

No new accounts, notebook collections, collaboration system, streaks, reminders, or storage format are part of this redesign.

## 2 Visual direction

Borrow the strong boundaries and obvious navigation from the references. Use the playful icons as punctuation. Reserve the heaviest borders and offset shadows for prominent controls and marketing panels, so a page of daily notes remains comfortable to read.

| Element | Proposed rule |
| --- | --- |
| Page | Warm off-white canvas with a slightly brighter writing surface |
| Text | Near-black body copy and clearly readable secondary text |
| Borders | 1px internal separators; 2px controls and major panel boundaries |
| Corners | 6px controls, 8px panels; pills only for tags and compact status labels |
| Shadows | Crisp 3px offset shadow on primary CTA and selected marketing panels; none around every note |
| Spacing | 4px base scale; use 8, 12, 16, 24, 32, 48, and 64px consistently |
| Layout | Strong alignment, visible section boundaries, generous writing margins |
| Motion | Short 120–180ms feedback; honor reduced motion; content visible without entrance animation |
| Decoration | Small icon accents and occasional margin details; no ruled lines behind body text |

Initial palette, subject to contrast testing in actual components:

| Token role | Light | Dark |
| --- | --- | --- |
| Canvas | `#F7F4EC` | `#191C24` |
| Writing surface | `#FFFEFA` | `#242833` |
| Primary text | `#202331` | `#F7F4EC` |
| Secondary text | `#555B68` | `#B9C0CF` |
| Strong border | `#202331` | `#D1D7E3` |
| Action accent | `#3046C5` | `#AAB8FF` |
| Decorative fills | Butter `#F4D66B`, mint `#BFE3CC`, apricot `#F4B49D` | Theme-specific subdued fills with light labels |

Use light text on the light theme's blue primary button, dark text on the dark theme's pale blue primary button. Decorative colors do not carry status alone. Errors, warnings, save failures, and sync conflicts retain distinct semantic styling and text.

Add Paper and Ink as the default light/dark pair for new users, following the system preference until explicitly selected. Keep existing theme choices available under Appearance and preserve saved selections. All themes receive the same structure, spacing, typography, and accessible controls. Do not silently replace an existing high-contrast preference.

### Alternatives considered

| Direction | Strength | Trade-off | Verdict |
| --- | --- | --- | --- |
| Current theme collection | Familiar to current users | Does not resolve fragmented typography or discoverability | Preserve preferences, replace shared visual structure |
| Full neo-brutalist interface | Strong match to heavy borders in the references | Repeated heavy frames and shadows compete with long notes | Use selectively for navigation and calls to action |
| Literary serif notebook | Warm and personal | Less direct match to the bright icons and practical controls | Offer serif writing inside the chosen system |
| Graphic field notebook | Clear controls, personal character, quiet writing area | Requires disciplined limits on accent colors and decoration | Recommended |

## 3 Typography and offered fonts

Use exactly three base families across both products:

| Family | Role | Starting specification |
| --- | --- | --- |
| **Figtree** | Wordmark, landing headings, interface, default note text | UI 14–16px; notes 17px/1.65; weights 400, 500, 600, 700 |
| **Source Serif 4** | Optional note body and occasional short editorial line on landing page | Notes 18px/1.65; regular, italic, semibold |
| **JetBrains Mono** | Code, keyboard shortcuts, optional monospaced note body | Code 14–15px/1.6; regular and medium |

Figtree supplies the friendly geometric character without making navigation decorative. Source Serif adds the personal reading quality of a book. Mono retains the engineering notebook's practical needs. Keep UI and note headings in Figtree even when users change note body style.

Landing headline: Figtree 700, approximately 56–64px on desktop and 36–40px on mobile. App page heading: 28–32px. Entry heading: 22–26px. Keep prose approximately 65–75 characters wide, with wider space available for code and drawings. Avoid all-caps navigation and thin body weights.

Replace the seven-option picker with three preview rows under **Settings → Appearance → Note font**:

- **Sans · Figtree**, default, for everyday writing.
- **Serif · Source Serif 4**, for a book-like reading experience.
- **Mono · JetBrains Mono**, for plain-text-style notes.

Each row previews the same short sentence. Selecting a row updates notes immediately while interface text stays stable.

Migration proposal: retain `figtree`, `serif`, and `monospace`; map `plus-jakarta-sans`, `dm-sans`, `urbanist`, and `inter` to `figtree`. Apply the mapping in both the localStorage startup path and IndexedDB settings load. Preserve the old preference in a migration backup until rollback is no longer needed. Mention the consolidated choices in release notes. Note content is untouched.

Self-host WOFF2 assets with their license files. Remove the Google Fonts imports and the separate Archivo/Playfair display styling. Load Figtree for the shell, then load the chosen body family and code face as needed; include the shipped assets in offline caching. Include real italic faces where used and retain readable system fallbacks. Verify the font licensing and final downloaded versions before vendoring.

## 4 Logo and icon system

Create an original vector mark: an upright notebook with a dark outline, one clear spine, a butter-colored cover, and a blue bookmark tab. Remove small page lines. Pair it with **WorkLedger** in Figtree 700, using consistent casing everywhere.

Deliver one master geometry with optical variants:

- Full wordmark and standalone mark for app navigation and landing page.
- Simplified favicon tested at 16px and 32px, including monochrome rendering.
- 192px and 512px installed-app assets, maskable variant with safe padding, and Apple touch icon.
- Light/dark variants where necessary, plus landing social preview and updated README imagery.

Inventory inline logo copies as well as files. Update app `public/logo.svg`, `favicon.svg`, `icon-192.svg`, `icon-512.svg`, manifest configuration in `vite.config.ts`, HTML metadata, and landing page branding together. An SVG update alone does not complete installed-app support.

Use Core Pop-style colored icons for Journal, Weekly review, Archive, templates, and the landing page's three main benefits. Start with a small set, approximately 8–12 assets. Use 24–28px navigation icons and 40–48px marketing icons. Keep small editor controls as simple monochrome symbols with matching rounded strokes. Labels remain the primary explanation of an action.

The pool app uses `*-Streamline-Flex.png` assets; the supplied link is Core Pop Free. They are not established as the same collection. Verify the exact set, file format, and license before importing. Prefer an explicitly open-source set suitable for distribution with WorkLedger's source. Keep any third-party license separate from the repository's MIT license and add visible credit in the landing footer and app About/Credits.

Streamline's current general free license requires attribution, limits use to 50 icons per project, and restricts redistribution as a selectable asset library. Use icons as interface assets; do not add a notebook sticker picker under that license. Exact set terms take precedence. If suitable vectors cannot be used, retain the existing simple UI icons and draw a small original decorative set.

## 5 App layout and behavior

### Desktop

Keep a stable sidebar, one readable writing column, and the optional AI panel. Avoid turning the notebook into a dashboard.

```text
┌──────────────────┬────────────────────────────────────────────────┐
│ [mark] WorkLedger│ Journal       [Search notes] [+ New entry]       │
│                  ├────────────────────────────────────────────────┤
│ Journal          │ Today · Wednesday, October 14                  │
│ Weekly review    │ [Start from template]                          │
│ Archive          │                                                │
│                  │ 09:10  [Decision]        [Focus] [Entry actions]│
│ Recent days      │ Why we changed the retry policy                │
│ Saved filters    │ Entry text...                                  │
│ Tags             │ [+ Tag] [backend]                              │
│ Signifiers       │                                                │
│                  │ Referenced by …                                │
│ Settings         │                                                │
│ Storage status   │                                                │
└──────────────────┴────────────────────────────────────────────────┘
```

- Retain Journal, Weekly review, and Archive as explicit navigation destinations. Show selected state through shape, text weight, and color.
- Make Search notes and New entry labeled controls. Expose Start from template beside the writing workflow, with named template choices after activation.
- Keep recent dates, tags, signifiers, and saved filters in the sidebar. Optional sections may collapse, but their labels and counts remain visible.
- Give each entry a persistent Focus control and **Entry actions** trigger. That menu contains labeled Pin, Copy link, Download Markdown, Archive, and applicable destructive actions. Keep signifier selection and Add tag visible. Show the existing confirmation before destructive actions.
- When AI is enabled, expose a labeled Think with AI control. When disabled, keep its setup in Settings without an empty side panel.
- Add a visible **Insert** trigger for existing editor commands, including drawings and entry links. Keep slash commands and `[[` as shortcuts. Discoverability must not require knowing special syntax.
- Settings opens clearly named Appearance, Storage and sync, Import and export, AI, and About sections. Keep deletion visually separate from routine settings.

“No hidden features” means visible entry points, meaningful labels, and complete keyboard/touch access. Secondary actions can live in an explicitly labeled menu; no capability should require hover or an undocumented gesture.

### Empty states

Remove the large notebook emoji. Keep the notebook as the product identity, not as repeated empty-state decoration. Do not delete stored entries or create placeholder entries as a cosmetic change.

| State | Presentation and action |
| --- | --- |
| Entire journal empty | Date, “A place for today's work.”, “A decision, a question, or one thing you learned.”, **Write your first entry**, secondary **Use a template**, and **Import notes** |
| Existing journal with nothing today | Small “What are you working on today?” prompt above prior entries; **New entry** remains visible |
| No filter matches | “No entries match these filters.” plus visible selected filters and **Clear filters** |
| No search results | Restate the query and offer editing/clearing it; do not present first-use onboarding |
| Empty archive | “Nothing archived.” plus a short explanation and **Back to journal** |
| Empty review week | Name the week, explain that it has no entries, and retain previous/next week controls |
| Loading or storage failure | Explicit loading/error state; never suggest the notebook is empty before reads succeed |

The first-entry button uses the existing creation flow and focuses the editor after creation. It must not start duplicate entries from repeated activation while creation is pending. Starting from a template uses the existing templates. Opening an empty journal alone writes no data.

### Mobile and daily return

- Keep the current preview-list and full-entry editing model. Reuse the same navigation state and actions.
- At narrow widths, show a labeled Menu control, current view, and New entry. Put a full-width Search notes control immediately below rather than squeezing everything into tiny icons.
- Use an explicit drawer for Journal, Weekly review, Archive, and organization. Keep primary entry actions visible in the entry view; use the existing action-sheet model for secondary operations.
- Use 44px touch targets, respect safe-area insets, and keep the editor usable when the software keyboard opens. Preserve at least 16px mobile input text.
- Use the date, familiar layout, and one optional writing prompt to make returning easy. Offer existing End of Day and review flows through visible template choices. Avoid streak pressure, confetti, or mandatory daily questions.
- Make save/storage state legible and accurate. “Saved on this device” must follow successful local persistence; remote status is separate. An install affordance can help users keep the notebook close, with platform-appropriate instructions where installation is supported.

## 6 Landing page

Build the landing page around the notebook's daily value, using the same logo, fonts, palette, and controls as the app. Keep the static HTML delivery model.

1. **Navigation:** WorkLedger wordmark, How it works, Your data, GitHub, and Open notebook. On mobile, preserve the primary CTA and a labeled navigation trigger.
2. **Hero:** “Keep the thinking behind your work.” Supporting copy: “A personal engineering notebook for decisions, questions, and the small things you will want to remember.” Primary CTA: **Open your notebook**. Secondary link: **See how it works**. Show a realistic, readable app example alongside it on desktop, below it on mobile.
3. **Daily rhythm:** Three connected examples, **Capture the moment**, **Find the thread**, **Look back on the week**. Each gets one colorful icon, a short explanation, and a focused product crop. Include code, a decision, and a linked follow-up rather than generic placeholder prose.
4. **Writing tools:** A compact section covering templates, drawings, tags, links, and search. Keep each capability understandable without reproducing the entire README.
5. **Your notebook stays yours:** Explain local browser storage, export, optional encrypted sync, and installation. Distinguish local-only operation from optional remote AI and sync. Do not promise that browser storage is a backup or that every feature works offline.
6. **Optional AI:** A small secondary section for working with selected notes, with an explicit statement that AI is optional. Link to configuration details instead of making AI the main product story.
7. **Closing CTA and footer:** “Make a note of it.”, Open your notebook, source repository, relevant documentation, and icon credits.

Use mostly paper-colored sections with one butter or mint panel. Avoid a rainbow of feature cards. Replace the old split-theme screenshot with a coherent light-theme example, and show dark mode separately where discussing appearance. Use synthetic sample notes without personal data. Images need responsive sizing and useful alternative text; reading content must not depend on JavaScript reveal effects.

## 7 Implementation sequence

| Slice | Work and primary locations | Completion evidence |
| --- | --- | --- |
| 1. Validate direction | Desktop journal, empty journal, mobile entry, and landing hero mockups using actual fonts and representative content; logo at small sizes | Review writing comfort, navigation visibility, icon weight, and light/dark balance together |
| 2. Foundations | `src/app.css`, `src/features/theme/`, `src/app/SettingsMenuItems.tsx`, self-hosted fonts, asset licenses, logo/favicon/PWA assets | Three font choices; persisted preference migration; offline fonts; old themes remain usable |
| 3. Daily app flow | `AppHeader`, `AppShell`, sidebar components, `EntryToolbar`, `EntryDetailControls`, `EmptyStates`, entry creation controls, editor command entry point | Complete capture/search/review flow on desktop and touch without hover dependence |
| 4. Secondary surfaces | Search, templates, filter states, review, archive, settings, AI, storage status, confirmations | Consistent spacing, labels, contrast, and error states across the full app |
| 5. Landing page | `../workledger-landing/index.html`, images, favicon, metadata, font assets | Same identity as app; concise content hierarchy; static/no-JS content works |
| 6. Release preparation | Screenshots, README feature counts, changelogs in applicable repos, license notices, regression checks | App and landing assets agree; documented migration and rollback |

Use the existing theme variables, shared icons, feature APIs, and component composition. Keep cross-feature coordination in `src/app/`. Preserve BlockNote, Excalidraw, search/index behavior, lazy loading, and autosave flushing. Do not rewrite storage or add a design-system dependency for this work.

Keep this document as the shared design reference. For two repositories, copy the small token/asset set with a recorded revision rather than introducing a package publishing pipeline. Prepare both releases together and deploy the app before publishing landing screenshots of the new UI.

## 8 Validation and release criteria

These are proposed acceptance targets, not measured results.

- **Usability:** ask a new user to create a decision note, tag it, find it, open weekly review, export it, and change note font without coaching. Investigate every missed control before release.
- **Visual:** review empty and populated screens at 360, 390, 768, 1280, and 1440px; long titles/tags; code and drawings; all retained themes; 200% zoom and narrow reflow. No clipped primary actions or page-wide overflow from normal prose.
- **Accessibility:** target WCAG 2.2 AA. Measure text contrast, control boundaries and focus indicators; check keyboard order, accessible names, menu focus return, screen-reader state announcements, reduced motion, and touch targets. Decorative icons must not duplicate spoken labels.
- **Persistence:** create/edit, immediately navigate away, reload, and verify the last text and drawing changes. Check local-only use, archive/restore, exports, optional sync, and storage errors. Failed saves remain visible and do not receive a success label.
- **Preference migration:** test each old font ID in both persistence stores, unknown IDs, store disagreement, system theme changes, explicit high-contrast selection, and rollback. Retain note content unchanged.
- **Offline and performance:** compare initial transferred bytes, font requests, layout shift, and long-journal responsiveness against a captured baseline. Test installed-app reload offline after caching. No remote font requests and no full icon-pack download.
- **Brand:** inspect actual 16px favicon, 32px favicon, home-screen icon, app header, landing header, and social image. Confirm asset licenses and attribution in both products.
- **Engineering:** run `npm run lint`, `npm run build`, and `npm run test` for implementation changes. Add focused coverage for preference migration and changed creation/error behavior; manually exercise the UI. Check landing links, build output, metadata, and no-JS readability.

Ship in reversible commits, separating foundations from navigation changes. Preserve original preferences for rollback; reverting CSS and assets must not require an entry database migration. Verify service-worker asset updates so old cached fonts and icons do not leave the interface inconsistent. Release steps: update CHANGELOG, commit, tag, push, and optionally publish a release.

## 9 Decisions to resolve through the first prototype

| Question | Proposed answer | Resolver and stage |
| --- | --- | --- |
| Does Figtree remain pleasant across a full working day? | Default to Figtree, offer Source Serif for body text | Product owner, compare real notes before broad implementation |
| How bold should the framing be? | Heavy navigation/CTA borders, quiet entry separators | Product owner, inspect dense populated prototype |
| Can the requested icon assets be redistributed with the source? | Prefer verified open-source Core Pop assets, retain separate credit/license | Implementer, verify exact download before vendoring |
| Is reducing seven note fonts to three acceptable for existing users? | Map retired sans choices to Figtree with release notes and reversible preference backup | Product owner, settle before migration ships |

Direction becomes accepted when the representative screens establish typography, border weight, icon family, and navigation behavior together. This plan does not establish measured improvements in engagement; revisit the direction if daily writing feels visually busy or users still cannot find the core actions.

## References

- User-supplied pool navigation and C40 screenshots: visual references for high contrast, visible navigation, and playful accents.
- [Figma serif overview](https://www.figma.com/resource-library/best-serif-fonts/) and [sans serif overview](https://www.figma.com/resource-library/best-sans-serif-fonts/): type exploration; the final pairing above is a WorkLedger design recommendation.
- [Figtree source and OFL license](https://github.com/erikdkennedy/figtree).
- [Source Serif project documentation and licensing](https://github.com/adobe-fonts/source-serif/wiki/Source-Serif-Readme).
- [JetBrains Mono and its OFL license](https://www.jetbrains.com/lp/mono/).
- [Requested Core Pop Free collection](https://www.streamlinehq.com/icons/core-pop-free/interface-essential?search=B). Exact collection terms remain to be verified; the collection page was not accessible through the research tool.
- [Streamline Free License](https://help.streamlinehq.com/en/articles/5354376-streamline-free-license), checked 14 October 2026. General terms do not establish the license of the exact assets used by the pool app.


## v4.0.0 implementation

The app ships Paper and Ink alongside Nord Aurora, Nord Polar Night, and both high-contrast themes. Solarized Light and Punktespiegel migrate to Paper; Dracula and Catppuccin Mocha migrate to Ink. All seven existing note-font choices remain available; the three core font families are self-hosted.

The production editor remains BlockNote with an open canvas. Entry tags appear below the content, signifiers use filled badges, and Small win is available in entries, filters, and weekly review. Saved filters store tags and signifiers; full-text search remains separate. The existing weekly review selects an ISO week rather than rendering the older multi-week card mockup.

Sidebar sections remain collapsible, Settings stays outside the scrolling region, and scrollbar tracks are hidden. AI setup uses a provider dropdown. The HTML mockup remains a design reference, not the production app. The separate landing-page repository is not part of this app release.
