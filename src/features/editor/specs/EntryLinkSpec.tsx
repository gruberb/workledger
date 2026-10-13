import { useState, useEffect } from "react";
import { createReactInlineContentSpec } from "@blocknote/react";
import { getEntry, getSearchRow, extractTitle } from "../../entries/index.ts";
import { emit } from "../../../utils/events.ts";

// eslint-disable-next-line react-refresh/only-export-components
function EntryLinkRenderer(props: {
  inlineContent: { props: { entryId: string; displayText: string } };
}) {
  const { entryId, displayText } = props.inlineContent.props;

  const [resolvedTitle, setResolvedTitle] = useState(displayText || "Untitled entry");
  const [isDeleted, setIsDeleted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // The search row is a small read that carries the title. Archived entries
    // have no row, so a miss falls back to the entry before calling it deleted.
    async function resolve() {
      const row = await getSearchRow(entryId);
      if (row?.title !== undefined) return { title: row.title };
      const entry = await getEntry(entryId);
      return entry ? { title: extractTitle(entry) } : null;
    }
    resolve().then((found) => {
      if (cancelled) return;
      setIsDeleted(!found);
      setResolvedTitle(found ? found.title : displayText || "Untitled entry");
    });
    return () => { cancelled = true; };
  }, [entryId, displayText]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDeleted) return;
    emit("navigate-entry", { entryId });
  };

  return (
    <span
      className={
        isDeleted
          ? "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 line-through cursor-default"
          : "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
      }
      onClick={handleClick}
      data-entry-link={entryId}
    >
      {resolvedTitle}{isDeleted ? " (deleted)" : ""}
    </span>
  );
}

export const entryLinkSpec = createReactInlineContentSpec(
  {
    type: "entryLink" as const,
    propSchema: {
      entryId: { default: "" },
      displayText: { default: "" },
    },
    content: "none",
  },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: (props) => <EntryLinkRenderer {...props as any} />,
  },
);
