/**
 * Crops a card from a sheet image using bbox percentages.
 * Uses Cloudflare Workers' built-in OffscreenCanvas API.
 */
export async function cropCardFromSheet(
  sheetBuffer: ArrayBuffer,
  mimeType: string,
  bbox: { x: number; y: number; width: number; height: number },
): Promise<ArrayBuffer | null> {
  try {
    // Decode the image using ImageDecoder (available in Cloudflare Workers)
    const decoder = new ImageDecoder({
      data: sheetBuffer,
      type: mimeType,
    });

    await decoder.decode();
    const { image } = await decoder.decode();

    const sheetWidth = image.displayWidth;
    const sheetHeight = image.displayHeight;

    // Convert bbox percentages to pixels
    const cropX = Math.floor((bbox.x / 100) * sheetWidth);
    const cropY = Math.floor((bbox.y / 100) * sheetHeight);
    const cropW = Math.floor((bbox.width / 100) * sheetWidth);
    const cropH = Math.floor((bbox.height / 100) * sheetHeight);

    if (cropW <= 0 || cropH <= 0) return null;

    // Draw crop onto OffscreenCanvas
    const canvas = new OffscreenCanvas(cropW, cropH);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
    return await blob.arrayBuffer();
  } catch (err) {
    console.error('cropCardFromSheet failed:', err);
    return null;
  }
}
