import { Component, type ReactNode } from "react";

export class ExcalidrawErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full bg-stone-50 dark:bg-stone-900 text-stone-400 dark:text-stone-500 rounded-lg border border-stone-200 dark:border-stone-700 p-8">
          <div className="text-center">
            <div className="text-sm font-medium text-stone-500 dark:text-stone-400 mb-1">Drawing failed to load</div>
            <button
              className="text-xs text-amber-600 hover:text-amber-700"
              onClick={() => this.setState({ hasError: false })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
