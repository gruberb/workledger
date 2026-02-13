import { useState, useEffect } from "react";
import { createReactInlineContentSpec } from "@blocknote/react";
import { getEntry } from "../../entries/storage/entries.ts";
import { extractTitle } from "../../entries/utils/extract-title.ts";

// eslint-disable-next-line react-refresh/only-export-components
function EntryLinkRenderer(props: {
  inlineContent: { props: { entryId: string; displayText: string } };
}) {
  const { entryId, displayText } = props.inlineContent.props;

  const [resolvedTitle, setResolvedTitle] = useState(displayText || "Untitled entry");
  const [isDeleted, setIsDeleted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEntry(entryId).then((entry) => {
      if (cancelled) return;
      if (!entry) {
        setIsDeleted(true);
        setResolvedTitle(displayText || "Untitled entry");
      } else {
        setIsDeleted(false);
        setResolvedTitle(extractTitle(entry));
      }
    });
    return () => { cancelled = true; };
  }, [entryId, displayText]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDeleted) return;
    window.dispatchEvent(
      new CustomEvent("workledger:navigate-entry", {
        detail: { entryId },
      }),
    );
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
