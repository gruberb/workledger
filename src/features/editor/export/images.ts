// Turns the images of an exported entry into PNG data URLs. Both the PDF and
// the Word renderer accept PNG, and drawing through a canvas also converts
// WebP, GIF and SVG, which neither handles natively.
import { renderPreviewSvg } from "../excalidraw/excalidrawLoader.ts";
import { parseDrawingData, sceneKey } from "../excalidraw/scene.ts";
import type { EntryDocument, ImageSource } from "../utils/entry-document.ts";

export interface Raster {
  dataUrl: string;
  /** Natural size in CSS pixels; renderers scale it down to the page width. */
  width: number;
  height: number;
}

/** Images that failed to load map to null and are exported as a link instead. */
export type RasterMap = Map<ImageSource, Raster | null>;

// A remote host that never answers must not hang the export.
const LOAD_TIMEOUT_MS = 10_000;
// Keeps photos from turning into multi-megabyte PNGs.
const MAX_SIDE_PX = 2000;

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  // Without CORS a remote image taints the canvas and toDataURL throws.
  img.crossOrigin = "anonymous";
  img.src = src;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Image timed out: ${src.slice(0, 80)}`)), LOAD_TIMEOUT_MS);
  });
  try {
    await Promise.race([img.decode(), timeout]);
    return img;
  } finally {
    clearTimeout(timer);
  }
}

/** `density` 2 keeps vector drawings sharp; bitmaps gain nothing from upscaling. */
function toPng(img: HTMLImageElement, density: number): Raster {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (!width || !height) throw new Error("Image has no size");
  const scale = Math.min(density, MAX_SIDE_PX / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL("image/png"), width, height };
}

async function svgToPng(svg: string): Promise<Raster> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    return toPng(await loadImage(url), 2);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Uses the stored preview unless it lags the drawing, as the block itself does. */
async function drawingSvg(source: Extract<ImageSource, { kind: "drawing" }>): Promise<string> {
  const parsed = parseDrawingData(source.drawingData);
  const snapshot = parsed.ok ? parsed.snapshot : null;
  const stale = !!snapshot && !!source.previewKey && sceneKey(snapshot) !== source.previewKey;
  if (source.previewSvg && !stale) return source.previewSvg;
  if (!snapshot) throw new Error("Drawing has no readable data");
  return renderPreviewSvg(snapshot);
}

async function rasterize(source: ImageSource): Promise<Raster> {
  if (source.kind === "drawing") return svgToPng(await drawingSvg(source));
  return toPng(await loadImage(source.url), 1);
}

export async function rasterizeImages(doc: EntryDocument): Promise<RasterMap> {
  const sources = doc.blocks.flatMap((b) => (b.type === "image" ? [b.source] : []));
  const rasters = await Promise.all(
    sources.map((source) =>
      rasterize(source).catch((err) => {
        console.warn("[export] image skipped", err);
        return null;
      }),
    ),
  );
  return new Map(sources.map((source, i) => [source, rasters[i]]));
}

/** Text that replaces an image that could not be embedded. */
export function imageFallbackText(source: ImageSource): string {
  return source.kind === "drawing" ? "[Drawing]" : `[Image: ${source.url.startsWith("data:") ? "embedded" : source.url}]`;
}
