import { useRef, useCallback, useEffect } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let exportToSvgFn: any = null;
import("@excalidraw/excalidraw").then((mod) => {
  exportToSvgFn = mod.exportToSvg;
});

export function useExcalidrawPersist(
  block: {
    id: string;
    props: { drawingData: string; previewSvg: string };
  },
  editor: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateBlock: (block: any, update: any) => void;
  },
  containerRef: React.RefObject<HTMLDivElement | null>,
  setIsEditing: (editing: boolean) => void,
) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestDataRef = useRef<{ elements: readonly any[]; appState: any } | null>(null);

  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (elements: readonly any[], appState: any) => {
      latestDataRef.current = { elements, appState };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const data = JSON.stringify({
          elements,
          appState: { viewBackgroundColor: appState.viewBackgroundColor },
        });
        editor.updateBlock(block, {
          props: { drawingData: data },
        });
      }, 300);
    },
    [block, editor],
  );

  const handleClickOutside = useCallback(
    async (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }

        const latest = latestDataRef.current;
        if (latest && exportToSvgFn) {
          const drawingData = JSON.stringify({
            elements: latest.elements,
            appState: { viewBackgroundColor: latest.appState?.viewBackgroundColor },
          });
          try {
            const svg = await exportToSvgFn({
              elements: [...latest.elements],
              appState: {
                ...(latest.appState || {}),
                exportBackground: true,
                viewBackgroundColor: "#f0f0f0",
                theme: "light",
              },
              files: null,
            });
            const svgString = new XMLSerializer().serializeToString(svg);
            editor.updateBlock(block, {
              props: { drawingData, previewSvg: svgString },
            });
          } catch {
            editor.updateBlock(block, { props: { drawingData } });
          }
        }
        latestDataRef.current = null;
        setIsEditing(false);
      }
    },
    [block, editor, containerRef, setIsEditing],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { handleChange, handleClickOutside };
}
