import { useState } from "react";
import { importEntries } from "../../entries/storage/import-export.ts";

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
            setImportStatus(`${result.imported} imported, ${result.skipped} skipped`);
            onRefresh();
            setTimeout(() => setImportStatus(null), 4000);
          } catch {
            setImportStatus("Import failed: invalid file");
            setTimeout(() => setImportStatus(null), 4000);
          }
          e.target.value = "";
        }}
      />

      {importStatus && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
          <div className={`
            px-4 py-2.5 rounded-full shadow-lg text-sm font-medium
            ${importStatus.startsWith("Import failed")
              ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
              : "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
            }
          `}>
            {importStatus}
          </div>
        </div>
      )}
    </>
  );
}

