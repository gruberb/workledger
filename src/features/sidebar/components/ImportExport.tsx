import { useState } from "react";
import { importEntries } from "../../entries/index.ts";
import { StatusToast } from "../../../components/ui/StatusToast.tsx";

interface ImportExportProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onRefresh: () => void;
}

export function ImportExport({ fileInputRef, onRefresh }: ImportExportProps) {
  const [importStatus, setImportStatus] = useState<string | null>(null);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const result = await importEntries(file);
            const parts = [`${result.imported} imported`, `${result.skipped} skipped`];
            if (result.invalid > 0) parts.push(`${result.invalid} invalid`);
            setImportStatus(parts.join(", "));
            onRefresh();
            setTimeout(() => setImportStatus(null), 4000);
          } catch {
            setImportStatus("Import failed: invalid file");
            setTimeout(() => setImportStatus(null), 4000);
          }
          e.target.value = "";
        }}
      />

      <StatusToast
        message={importStatus}
        tone={importStatus?.startsWith("Import failed") ? "error" : "success"}
      />
    </>
  );
}

