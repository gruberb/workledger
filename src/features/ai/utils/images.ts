import type { AIImage } from "../providers/types.ts";

/**
 * Longest edge sent to the model. Anthropic and OpenAI downscale larger images
 * anyway, so sending more only costs upload time, tokens and IndexedDB space.
 */
export const DEFAULT_MAX_EDGE = 1568;

/** Size of an image scaled to fit `maxEdge`, never enlarged. */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Reads a pasted or dropped image, downscaled. PNG stays PNG so text in
 * screenshots stays sharp; everything else becomes JPEG.
 */
export async function readImageFile(file: File, maxEdge = DEFAULT_MAX_EDGE): Promise<AIImage> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name || "This file"} is not an image`);
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not read the image");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const mediaType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const dataUrl = canvas.toDataURL(mediaType, 0.85);
    return { mediaType, data: dataUrl.slice(dataUrl.indexOf(",") + 1) };
  } finally {
    bitmap.close();
  }
}

export function imageDataUrl(image: AIImage): string {
  return `data:${image.mediaType};base64,${image.data}`;
}
