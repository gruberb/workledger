import { useCallback, useEffect, useRef, useState } from "react";
import type { ExportFormat, WorkLedgerEntry } from "../../features/entries/index.ts";

export interface DownloadStatus {
  message: string;
  tone: "success" | "error";
}

const ERROR_TOAST_MS = 6000;
const LABELS: Record<ExportFormat, string> = { markdown: "Markdown", docx: "Word document", pdf: "PDF" };

/**
 * Entry downloads, composed here so the entries feature never imports the editor.
 * PDF and Word load their libraries on demand (not precached, so they fail
 * offline) and can take a moment, so both progress and failure are shown.
 */
export function useEntryDownload() {
  const [status, setStatus] = useState<DownloadStatus | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleDownload = useCallback(async (entry: WorkLedgerEntry, format: ExportFormat) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (format !== "markdown") setStatus({ message: `Preparing ${LABELS[format]}...`, tone: "success" });
    try {
      const { downloadEntry } = await import("../../features/editor/export.ts");
      await downloadEntry(entry, format);
      setStatus(null);
    } catch (err) {
      console.error(`[export] ${format} failed`, err);
      const offline = !navigator.onLine ? " PDF and Word downloads need an internet connection." : "";
      setStatus({ message: `${LABELS[format]} download failed.${offline}`, tone: "error" });
      timerRef.current = setTimeout(() => setStatus(null), ERROR_TOAST_MS);
    }
  }, []);

  return { handleDownload, status };
}
