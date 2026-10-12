import { useEffect, useRef, useState } from "react";
import { useEntriesActions } from "../../entries/index.ts";
import { StatusToast } from "../../../components/ui/StatusToast.tsx";

interface LogseqImportInputProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
}

interface Status {
  message: string;
  tone: "success" | "error";
  /** Progress messages stay until the import finishes. */
  sticky?: boolean;
}

const TOAST_MS = 6000;

/**
 * Hidden folder picker plus its result toast. Rendered outside the settings
 * menu: the menu unmounts on close, which would drop the picker's change event.
 */
export function LogseqImportInput({ inputRef }: LogseqImportInputProps) {
  const { refresh } = useEntriesActions();
  const [status, setStatus] = useState<Status | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // webkitdirectory is not in React's input attribute types; every current
  // browser supports it for picking a folder.
  useEffect(() => {
    inputRef.current?.setAttribute("webkitdirectory", "");
  }, [inputRef]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const show = (next: Status) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus(next);
    if (!next.sticky) timerRef.current = setTimeout(() => setStatus(null), TOAST_MS);
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    show({ message: "Importing Logseq graph...", tone: "success", sticky: true });
    try {
      const { importLogseqGraph } = await import("../import-graph.ts");
      const result = await importLogseqGraph(files);
      await refresh();
      const parts = [`${result.imported} imported`];
      if (result.unchanged > 0) parts.push(`${result.unchanged} unchanged`);
      if (result.skippedFiles > 0) parts.push(`${result.skippedFiles} files skipped`);
      if (result.skippedAssets > 0) parts.push(`${result.skippedAssets} images not imported`);
      show({ message: parts.join(", "), tone: "success" });
    } catch (err) {
      console.error("[logseq-import] failed", err);
      show({ message: `Import failed: ${err instanceof Error ? err.message : "unknown error"}`, tone: "error" });
    } finally {
      e.target.value = "";
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={handleChange} />
      <StatusToast message={status?.message ?? null} tone={status?.tone} />
    </>
  );
}
