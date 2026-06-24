/**
 * Image processing utilities for manual QR selection.
 *
 * PDF rendering reuses the shared `loadPdfJs()` from the CNMC extraction layer,
 * which configures the pdfjs worker correctly for this build (single source of
 * truth — no separate worker path to keep in sync).
 */

import { loadPdfJs } from '../lib/cnmc/extraction';

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Scale used for PDF display (lower for faster rendering)
export const PDF_DISPLAY_SCALE = 2;
// Scale used for PDF cropping/QR extraction (higher for better quality)
export const PDF_CROP_SCALE = 5;

/**
 * Convert a File (PDF or image) to a data URL for display.
 * For PDFs, converts the first page to an image at display scale.
 * For images, returns the data URL directly.
 */
export async function fileToDataUrl(file: File, pageNumber = 1): Promise<string> {
  if (file.type === 'application/pdf') {
    return await pdfToDataUrl(file, PDF_DISPLAY_SCALE, pageNumber);
  } else {
    return await imageFileToDataUrl(file);
  }
}

/**
 * Convert an image file to a data URL
 */
async function imageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Convert the first page of a PDF to a data URL image
 */
async function pdfToDataUrl(file: File, scale: number, pageNumber = 1): Promise<string> {
  const pdfjs = await loadPdfJs();

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  // Create canvas
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to get canvas context');
  }

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  // Render PDF page to canvas
  await page.render({
    canvasContext: context,
    viewport: viewport,
    canvas: canvas as any,
  }).promise;

  // Convert canvas to data URL
  return canvas.toDataURL('image/png');
}

/**
 * Crop a region from an image data URL and return as a new File.
 * For images that were originally PDFs, use cropPdfToFile instead for better quality.
 */
export async function cropImageToFile(
  dataUrl: string,
  cropArea: CropArea,
  originalFileName: string,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Set canvas size to crop area
      canvas.width = cropArea.width;
      canvas.height = cropArea.height;

      // Disable image smoothing to preserve sharp QR code edges
      ctx.imageSmoothingEnabled = false;

      // Draw the cropped region
      ctx.drawImage(
        img,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
        0,
        0,
        cropArea.width,
        cropArea.height,
      );

      // Convert to blob and then to File
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob from cropped image'));
            return;
          }
          const fileName = `cropped_${originalFileName.replace(/\.[^/.]+$/, '')}.png`;
          const file = new File([blob], fileName, { type: 'image/png' });
          resolve(file);
        },
        'image/png',
        1.0,
      );
    };
    img.onerror = () => reject(new Error('Failed to load image for cropping'));
    img.src = dataUrl;
  });
}

/**
 * Crop a region from a PDF file at high resolution.
 * This re-renders the PDF at a higher scale for better QR code detection.
 *
 * @param pdfFile - The original PDF file
 * @param cropArea - The crop area in display image coordinates (from QrManualSelector)
 * @param originalFileName - Original file name for the output file
 * @returns A new File containing the cropped region at high resolution
 */
export async function cropPdfToFile(
  pdfFile: File,
  cropArea: CropArea,
  originalFileName: string,
  pageNumber = 1,
): Promise<File> {
  const pdfjs = await loadPdfJs();

  const arrayBuffer = await pdfFile.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  const page = await pdfDoc.getPage(pageNumber);

  // Render at high scale for maximum quality
  const viewport = page.getViewport({ scale: PDF_CROP_SCALE });

  // Create canvas for high-res rendering
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to get canvas context');
  }

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  // Render PDF page to canvas at high resolution
  await page.render({
    canvasContext: context,
    viewport: viewport,
    canvas: canvas as any,
  }).promise;

  // Calculate the crop coordinates at high resolution.
  // The cropArea is in display scale coordinates, convert to high-res scale.
  const scaleRatio = PDF_CROP_SCALE / PDF_DISPLAY_SCALE;
  const highResCropArea: CropArea = {
    x: Math.round(cropArea.x * scaleRatio),
    y: Math.round(cropArea.y * scaleRatio),
    width: Math.round(cropArea.width * scaleRatio),
    height: Math.round(cropArea.height * scaleRatio),
  };

  // Create a new canvas for the cropped region
  const cropCanvas = document.createElement('canvas');
  const cropCtx = cropCanvas.getContext('2d');
  if (!cropCtx) {
    throw new Error('Failed to get crop canvas context');
  }

  cropCanvas.width = highResCropArea.width;
  cropCanvas.height = highResCropArea.height;

  // Disable image smoothing to preserve sharp QR code edges
  cropCtx.imageSmoothingEnabled = false;

  // Draw the cropped region from the high-res render
  cropCtx.drawImage(
    canvas,
    highResCropArea.x,
    highResCropArea.y,
    highResCropArea.width,
    highResCropArea.height,
    0,
    0,
    highResCropArea.width,
    highResCropArea.height,
  );

  // Convert to File
  return new Promise((resolve, reject) => {
    cropCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob from cropped PDF region'));
          return;
        }
        const fileName = `cropped_${originalFileName.replace(/\.[^/.]+$/, '')}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });
        resolve(file);
      },
      'image/png',
      1.0,
    );
  });
}

/**
 * Get the dimensions of an image from a data URL
 */
export async function getImageDimensions(
  dataUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}
