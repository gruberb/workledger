import { FilterBanner } from "./FilterBanner.tsx";

export function EmptyArchive() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-20">
      <div className="text-5xl mb-6 text-gray-200">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-gray-300">
          <polyline points="21 8 21 21 3 21 3 8" />
          <rect x="1" y="3" width="22" height="5" />
          <line x1="10" y1="12" x2="14" y2="12" />
        </svg>
      </div>
      <h2 className="text-xl text-gray-400 font-light mb-2">
        Archive is empty
      </h2>
      <p className="text-sm text-gray-400 max-w-sm">
        Archived entries will appear here. Archive entries from the main view using the box icon.
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
        Press <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">⌘J</kbd> or
        click the button below to create your first notebook entry.
      </p>
    </div>
  );
}

export function EmptyFilterResults({ filterQuery, onClearFilter }: { filterQuery: string; onClearFilter?: () => void }) {
  return (
    <div className="entry-stream">
      <FilterBanner query={filterQuery} count={0} onClear={onClearFilter} />
      <div className="flex flex-col items-center text-center py-16">
        <p className="text-gray-400 text-sm">No entries match "{filterQuery}"</p>
      </div>
    </div>
  );
}
