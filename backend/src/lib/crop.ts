/**
 * crop.ts — Server-side card cropping using OffscreenCanvas + createImageBitmap
 *
 * ImageDecoder is not reliably available in the Cloudflare Workers runtime.
 * This implementation uses createImageBitmap() which IS supported in Workers,
 * together with OffscreenCanvas to produce a JPEG crop of a bounding-box region.
 *
 * bbox values are percentages (0–100) of the sheet dimensions.
 */

export interface BoundingBox {
  x: number;      // left edge as % of sheet width
  y: number;      // top edge as % of sheet height
  width: number;  // crop width as % of sheet width
  height: number; // crop height as % of sheet height
}

/**
 * Crop a region from a sheet image buffer.
 * Returns a JPEG ArrayBuffer of the cropped region, or null on failure.
 */
export async function cropCardFromSheet(
  sheetBuffer: ArrayBuffer,
  mimeType: string,
  bbox: BoundingBox,
): Promise<ArrayBuffer | null> {
  try {
    // createImageBitmap is available in Cloudflare Workers (V8 isolates)
    const blob = new Blob([sheetBuffer], { type: mimeType });
    const bitmap = await createImageBitmap(blob);

    const sheetWidth = bitmap.width;
    const sheetHeight = bitmap.height;

    const cropX = Math.floor((bbox.x / 100) * sheetWidth);
    const cropY = Math.floor((bbox.y / 100) * sheetHeight);
    const cropW = Math.floor((bbox.width / 100) * sheetWidth);
    const cropH = Math.floor((bbox.height / 100) * sheetHeight);

    if (cropW <= 0 || cropH <= 0) {
      console.error('[crop] Invalid crop dimensions:', { cropX, cropY, cropW, cropH, sheetWidth, sheetHeight, bbox });
      return null;
    }

    const canvas = new OffscreenCanvas(cropW, cropH);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('[crop] Failed to get 2d context from OffscreenCanvas');
      return null;
    }

    ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const outBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
    return await outBlob.arrayBuffer();
  } catch (err) {
    console.error('[crop] cropCardFromSheet failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
