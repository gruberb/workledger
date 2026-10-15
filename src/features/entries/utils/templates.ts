import type { PartialBlock } from "@blocknote/core";
import type { EntrySignifier } from "../types/entry.ts";

export interface EntryTemplate {
  id: string;
  name: string;
  icon: string;
  tag?: string;
  signifier?: EntrySignifier;
  blocks: PartialBlock[];
}

// Placeholder text is regular body text on purpose: it reads as a normal line to
// overwrite, and only the bold labels in `field` mark the structure.
function plain(text: string) {
  return [{ type: "text" as const, text, styles: {} }];
}

function heading(text: string, level: 2 | 3 = 2): PartialBlock {
  return { type: "heading", props: { level }, content: text };
}

function hint(text: string): PartialBlock {
  return { type: "paragraph", content: plain(text) };
}

/** "Label: hint" line, so the label survives when the hint is overwritten. */
function field(label: string, placeholder: string): PartialBlock {
  return {
    type: "bulletListItem",
    content: [{ type: "text", text: `${label}: `, styles: { bold: true } }, ...plain(placeholder)],
  };
}

function table(header: string[], rows = 1): PartialBlock {
  return {
    type: "table",
    content: {
      type: "tableContent",
      headerRows: 1,
      rows: [{ cells: header }, ...Array.from({ length: rows }, () => ({ cells: header.map(() => "") }))],
    },
  };
}

// RFD = Request for Discussion. Each section is a heading plus hints, so shortening
// an RFD means deleting sections; the brief and full variants share the five lines.
const RFD_STATUS: PartialBlock[] = [
  field("Status", "draft / discussion / approved / rejected / superseded / withdrawn"),
  field("Delivery", "not started / in progress / verified / released / not applicable"),
  field("Next action", "One specific investigation, review or implementation step"),
];

const RFD_FIVE_LINES: PartialBlock[] = [
  field("Problem", "What happens now, who is affected, and why does it matter?"),
  field("Outcome", "One observable finish condition for this work"),
  field("Scope", "What must stay unchanged, and what is out of scope?"),
  field("Uncertainty", "Which open question could invalidate the approach?"),
  field("Next check", "The smallest action that reduces that uncertainty"),
];

const RFD_LOG_COLUMNS = ["Date", "Evidence or question", "Interpretation", "Decision changed or kept", "Next action"];

export const ENTRY_TEMPLATES: EntryTemplate[] = [
  {
    id: "rfd-brief",
    name: "RFD (brief)",
    icon: "R",
    signifier: "rfd",
    blocks: [
      ...RFD_STATUS,
      heading("Intent"),
      ...RFD_FIVE_LINES,
      heading("Log"),
      table(RFD_LOG_COLUMNS),
      heading("Closeout"),
      hint("What happened compared with the intended outcome? Which assumption failed?"),
      { type: "paragraph", content: "" },
    ],
  },
  {
    id: "rfd-full",
    name: "RFD (full)",
    icon: "R",
    signifier: "rfd",
    blocks: [
      heading("Summary"),
      field("Owner", "Person maintaining this document"),
      field("Reviewers", "Decision owner and reviewers, or unassigned"),
      ...RFD_STATUS,
      field("Current direction", "One sentence, provisional until approved"),
      heading("Intent"),
      ...RFD_FIVE_LINES,
      heading("1. Problem and outcome"),
      field("Current problem", "Condition, affected user or operator, consequence, evidence"),
      field("Desired outcome", "Observable improvement, independent of the preferred technology"),
      field("Example", "Input or situation, action, expected result"),
      heading("Goals", 3),
      { type: "bulletListItem", content: plain("G1: goal and how it will be evaluated") },
      heading("Non-goals", 3),
      { type: "bulletListItem", content: plain("Plausible adjacent work excluded from this change") },
      heading("2. Current system and constraints"),
      hint("Trace one representative case through the existing system: inputs, components, state, outputs, consumers."),
      table(["Statement", "Kind", "Evidence or authority", "Implication"]),
      field("Preserved behavior", "What consumers or operators rely on"),
      field("Constraints", "Platform, compatibility, privacy, operations, schedule, with sources"),
      heading("3. Unknowns and investigations"),
      table(["Question", "Hypothesis", "Decision affected", "Resolving evidence", "State"]),
      heading("4. Options and decision"),
      hint("Each credible option with its trade-offs against the goals. Separate findings from hypotheses."),
      field("Decision", "Chosen option and why, or what evidence is still missing"),
      heading("5. Contract"),
      hint("Interfaces, data, behavior and failure semantics the implementation must satisfy."),
      heading("6. Acceptance cases"),
      { type: "checkListItem", content: plain("Success case: input, expected result") },
      { type: "checkListItem", content: plain("Failure case: input, expected error or recovery") },
      heading("7. Implementation and verification"),
      table(["Slice", "Outcome", "Depends on", "Required checks", "State and evidence"]),
      field("Rollout and rollback", "Transition, gates, owner and recovery action"),
      heading("8. Checkpoint and log"),
      field("Decisions settled / open", ""),
      field("Checks run and results", ""),
      field("Blockers", ""),
      table(RFD_LOG_COLUMNS),
      heading("Closeout"),
      hint("What happened compared with the intended outcome? Which assumption failed? What should the next reader know?"),
      { type: "paragraph", content: "" },
    ],
  },
  {
    id: "decision-log",
    name: "Decision Log",
    icon: "D",
    tag: "decision",
    blocks: [
      { type: "heading", props: { level: 2 }, content: "Context" },
      { type: "paragraph", content: plain("What situation or problem prompted this decision?") },
      { type: "bulletListItem", content: plain("Who is affected?") },
      { type: "bulletListItem", content: plain("What constraints exist (time, budget, tech)?") },
      { type: "bulletListItem", content: plain("What alternatives were considered?") },
      { type: "heading", props: { level: 2 }, content: "Decision" },
      { type: "paragraph", content: plain("State the decision clearly in one sentence.") },
      { type: "paragraph", content: plain("Why this option over the alternatives?") },
      { type: "heading", props: { level: 2 }, content: "Consequences" },
      { type: "bulletListItem", content: plain("What improves as a result?") },
      { type: "bulletListItem", content: plain("What trade-offs are we accepting?") },
      { type: "bulletListItem", content: plain("What risks does this introduce?") },
      { type: "heading", props: { level: 2 }, content: "Follow-up" },
      { type: "checkListItem", content: plain("Communicate decision to team") },
      { type: "checkListItem", content: plain("Review decision in 2 weeks") },
      { type: "paragraph", content: "" },
    ],
  },
  {
    id: "debugging-session",
    name: "Debugging Session",
    icon: "B",
    tag: "debugging",
    blocks: [
      { type: "heading", props: { level: 2 }, content: "Problem" },
      { type: "paragraph", content: plain("What is the symptom? What did you expect vs. what happened?") },
      { type: "bulletListItem", content: plain("Error message or unexpected behavior:") },
      { type: "bulletListItem", content: plain("How to reproduce:") },
      { type: "bulletListItem", content: plain("When did it start? What changed recently?") },
      { type: "heading", props: { level: 2 }, content: "Hypothesis" },
      { type: "numberedListItem", content: plain("Most likely cause and why you think so") },
      { type: "numberedListItem", content: plain("Alternative cause") },
      { type: "heading", props: { level: 2 }, content: "Investigation" },
      { type: "checkListItem", content: plain("Check logs / error output") },
      { type: "checkListItem", content: plain("Reproduce in isolation") },
      { type: "checkListItem", content: plain("Add logging / breakpoints") },
      { type: "checkListItem", content: plain("Test hypothesis") },
      { type: "heading", props: { level: 2 }, content: "Root Cause" },
      { type: "paragraph", content: plain("What was actually wrong?") },
      { type: "heading", props: { level: 2 }, content: "Fix" },
      { type: "paragraph", content: plain("What did you change? Link to PR/commit if applicable.") },
      { type: "heading", props: { level: 2 }, content: "Lessons" },
      { type: "bulletListItem", content: plain("What would have caught this sooner?") },
      { type: "bulletListItem", content: plain("Should a test/alert be added?") },
      { type: "paragraph", content: "" },
    ],
  },
  {
    id: "meeting-notes",
    name: "Meeting Notes",
    icon: "M",
    tag: "meeting",
    blocks: [
      { type: "heading", props: { level: 2 }, content: "Meeting Info" },
      { type: "bulletListItem", content: plain("Topic:") },
      { type: "bulletListItem", content: plain("Date:") },
      { type: "bulletListItem", content: plain("Attendees:") },
      { type: "heading", props: { level: 2 }, content: "Agenda" },
      { type: "numberedListItem", content: plain("First topic") },
      { type: "numberedListItem", content: plain("Second topic") },
      { type: "heading", props: { level: 2 }, content: "Discussion Notes" },
      { type: "paragraph", content: plain("Key points, context, and decisions made during the meeting.") },
      { type: "paragraph", content: "" },
      { type: "heading", props: { level: 2 }, content: "Decisions" },
      { type: "bulletListItem", content: plain("Decision 1 — rationale") },
      { type: "heading", props: { level: 2 }, content: "Action Items" },
      { type: "checkListItem", content: plain("Action — @owner — due date") },
      { type: "checkListItem", content: plain("Action — @owner — due date") },
      { type: "heading", props: { level: 2 }, content: "Open Questions" },
      { type: "bulletListItem", content: plain("Question that needs follow-up") },
      { type: "paragraph", content: "" },
    ],
  },
  {
    id: "learning-log",
    name: "Learning Log",
    icon: "L",
    tag: "learning",
    blocks: [
      { type: "heading", props: { level: 2 }, content: "What I Learned" },
      { type: "paragraph", content: plain("Explain the concept in your own words, as if teaching someone else.") },
      { type: "paragraph", content: "" },
      { type: "heading", props: { level: 2 }, content: "Key Takeaways" },
      { type: "bulletListItem", content: plain("Most important insight") },
      { type: "bulletListItem", content: plain("Second insight") },
      { type: "bulletListItem", content: plain("What surprised you?") },
      { type: "heading", props: { level: 2 }, content: "Source" },
      { type: "bulletListItem", content: plain("Article, talk, documentation, conversation, etc.") },
      { type: "bulletListItem", content: plain("Link:") },
      { type: "heading", props: { level: 2 }, content: "How to Apply" },
      { type: "paragraph", content: plain("Where in your current work could you use this?") },
      { type: "checkListItem", content: plain("Try it in a real project") },
      { type: "checkListItem", content: plain("Share with the team") },
      { type: "heading", props: { level: 2 }, content: "Related" },
      { type: "paragraph", content: plain("Link to related entries with [[ or note connections to other topics.") },
      { type: "paragraph", content: "" },
    ],
  },
  {
    id: "end-of-day",
    name: "End of Day",
    icon: "E",
    tag: "eod",
    blocks: [
      { type: "heading", props: { level: 2 }, content: "Done Today" },
      { type: "checkListItem", content: plain("Accomplishment or task completed") },
      { type: "checkListItem", content: plain("Another win — add as many as needed") },
      { type: "heading", props: { level: 2 }, content: "In Progress" },
      { type: "bulletListItem", content: plain("Task — where you left off — next step") },
      { type: "bulletListItem", content: plain("Link to PR/branch/doc if applicable") },
      { type: "heading", props: { level: 2 }, content: "Blocked" },
      { type: "bulletListItem", content: plain("What's stuck — who/what can unblock it") },
      { type: "heading", props: { level: 2 }, content: "Tomorrow's Priorities" },
      { type: "numberedListItem", content: plain("Most important task") },
      { type: "numberedListItem", content: plain("Second priority") },
      { type: "numberedListItem", content: plain("Third priority") },
      { type: "heading", props: { level: 2 }, content: "Follow-ups" },
      { type: "checkListItem", content: plain("Person to contact — topic") },
      { type: "checkListItem", content: plain("Open discussion to revisit") },
      { type: "heading", props: { level: 2 }, content: "Meetings" },
      { type: "checkListItem", content: plain("Meeting to prep for") },
      { type: "checkListItem", content: plain("Meeting to schedule") },
      { type: "heading", props: { level: 2 }, content: "To Review" },
      { type: "checkListItem", content: plain("PR, document, or proposal needing attention") },
      { type: "heading", props: { level: 2 }, content: "Brain Dump" },
      { type: "paragraph", content: plain("Random ideas, thoughts, parking lot items — get it out of your head.") },
      { type: "paragraph", content: "" },
    ],
  },
];
