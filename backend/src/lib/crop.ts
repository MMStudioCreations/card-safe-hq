/**
 * crop.ts — Server-side card cropping using OffscreenCanvas + createImageBitmap
 *
 * ImageDecoder is not reliably available in the Cloudflare Workers runtime.
 * This implementation uses createImageBitmap() which IS supported in Workers,
 * together with OffscreenCanvas to produce a JPEG crop of a bounding-box region.
 *
 * bbox values are percentages (0–100) of the sheet dimensions.
 *
 * After cropping, the image is upscaled to at least 800px on the short side
 * (max 1600px on the long side) so the AI vision model can read card text
 * and card numbers accurately.
 */

export interface BoundingBox {
  x: number;      // left edge as % of sheet width
  y: number;      // top edge as % of sheet height
  width: number;  // crop width as % of sheet width
  height: number; // crop height as % of sheet height
}

/**
 * Crop a region from a sheet image buffer and upscale it for AI identification.
 * Returns a JPEG ArrayBuffer of the cropped+upscaled region, or null on failure.
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

    // Add a small padding (2%) around the bbox to avoid clipping card edges
    const PAD = 2;
    const rawX = bbox.x - PAD;
    const rawY = bbox.y - PAD;
    const rawW = bbox.width + PAD * 2;
    const rawH = bbox.height + PAD * 2;

    const cropX = Math.max(0, Math.floor((rawX / 100) * sheetWidth));
    const cropY = Math.max(0, Math.floor((rawY / 100) * sheetHeight));
    const cropW = Math.min(sheetWidth - cropX, Math.floor((rawW / 100) * sheetWidth));
    const cropH = Math.min(sheetHeight - cropY, Math.floor((rawH / 100) * sheetHeight));

    if (cropW <= 0 || cropH <= 0) {
      console.error('[crop] Invalid crop dimensions:', { cropX, cropY, cropW, cropH, sheetWidth, sheetHeight, bbox });
      return null;
    }

    // Step 1: Draw the crop at native resolution
    const cropCanvas = new OffscreenCanvas(cropW, cropH);
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) {
      console.error('[crop] Failed to get 2d context from OffscreenCanvas');
      return null;
    }
    cropCtx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    // Step 2: Upscale so the short side is at least 800px (max 1600px long side)
    // This dramatically improves AI OCR accuracy on card numbers and text.
    const MIN_SHORT = 800;
    const MAX_LONG  = 1600;

    let outW = cropW;
    let outH = cropH;

    const shortSide = Math.min(cropW, cropH);
    if (shortSide < MIN_SHORT) {
      const scale = MIN_SHORT / shortSide;
      outW = Math.round(cropW * scale);
      outH = Math.round(cropH * scale);
    }
    const longSide = Math.max(outW, outH);
    if (longSide > MAX_LONG) {
      const scale = MAX_LONG / longSide;
      outW = Math.round(outW * scale);
      outH = Math.round(outH * scale);
    }

    if (outW !== cropW || outH !== cropH) {
      const upCanvas = new OffscreenCanvas(outW, outH);
      const upCtx = upCanvas.getContext('2d');
      if (upCtx) {
        upCtx.imageSmoothingEnabled = true;
        upCtx.imageSmoothingQuality = 'high';
        upCtx.drawImage(cropCanvas, 0, 0, cropW, cropH, 0, 0, outW, outH);
        const upBlob = await upCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
        return await upBlob.arrayBuffer();
      }
    }

    const outBlob = await cropCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
    return await outBlob.arrayBuffer();
  } catch (err) {
    console.error('[crop] cropCardFromSheet failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
