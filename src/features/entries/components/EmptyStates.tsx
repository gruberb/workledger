import { ArchiveIcon } from "../../../components/ui/Icons.tsx";

export function EmptyArchive() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-20">
      <div className="text-5xl mb-6 text-gray-200">
        <ArchiveIcon size={48} strokeWidth={1.5} className="mx-auto text-gray-300" />
      </div>
      <h2 className="text-xl text-gray-400 font-light mb-2">
        Archive is empty
      </h2>
      <p className="text-sm text-gray-400 max-w-sm">
        Archived entries will appear here. Archive entries from the main view using the{" "}
        <span className="max-md:hidden">box icon.</span>
        <span className="md:hidden">actions menu (⋯) of an open entry.</span>
      </p>
    </div>
  );
}

export function EmptyEntries() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-20">
      <div className="text-6xl mb-6 text-gray-300">📓</div>
      <h2 className="text-2xl text-gray-500 font-light mb-3">
        Start your first entry
      </h2>
      <p className="text-base text-gray-400 max-w-sm">
        <span className="max-md:hidden">
          Press <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">⌘J</kbd> or
          click the button below to create your first notebook entry.
        </span>
        <span className="md:hidden">Tap + in the top bar to create your first notebook entry.</span>
      </p>
    </div>
  );
}
