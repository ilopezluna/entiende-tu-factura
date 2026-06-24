import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CropArea, getImageDimensions } from '../utils/imageProcessing';
import {
  Search,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from './ui';

interface QrManualSelectorProps {
  imageDataUrl: string;
  onCropConfirm: (cropArea: CropArea) => void;
  onCancel: () => void;
  isProcessing?: boolean;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

interface Point {
  x: number;
  y: number;
}

const MIN_SELECTION_SIZE = 20; // Minimum 20px selection (reduced for mobile)
const PREVIEW_MAX_SIZE = 150; // Max size for live preview thumbnail

const QrManualSelector: React.FC<QrManualSelectorProps> = ({
  imageDataUrl,
  onCropConfirm,
  onCancel,
  isProcessing = false,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [displayDimensions, setDisplayDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [scale, setScale] = useState(1);
  const [selection, setSelection] = useState<CropArea | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Check if selection is valid
  const isValidSelection =
    selection && selection.width >= MIN_SELECTION_SIZE && selection.height >= MIN_SELECTION_SIZE;

  // Load image and calculate dimensions
  useEffect(() => {
    const loadImage = async () => {
      try {
        const dims = await getImageDimensions(imageDataUrl);
        setImageDimensions(dims);

        // Calculate display dimensions to fit in container
        // Use more screen space on mobile devices
        const isMobile = window.innerWidth < 768;
        const maxWidth = isMobile
          ? window.innerWidth - 32 // 16px padding on each side for mobile
          : Math.min(window.innerWidth - 80, 800);
        const maxHeight = isMobile
          ? window.innerHeight - 280 // Less reserved space for mobile
          : Math.min(window.innerHeight - 400, 500);

        let displayWidth = dims.width;
        let displayHeight = dims.height;
        let newScale = 1;

        // Scale down if necessary
        if (displayWidth > maxWidth) {
          newScale = maxWidth / displayWidth;
          displayWidth = maxWidth;
          displayHeight = dims.height * newScale;
        }

        if (displayHeight > maxHeight) {
          const additionalScale = maxHeight / displayHeight;
          newScale *= additionalScale;
          displayHeight = maxHeight;
          displayWidth *= additionalScale;
        }

        setScale(newScale);
        setDisplayDimensions({
          width: Math.round(displayWidth),
          height: Math.round(displayHeight),
        });

        // Load image for canvas
        const img = new Image();
        img.onload = () => {
          imageRef.current = img;
          setImageLoaded(true);
        };
        img.src = imageDataUrl;
      } catch (error) {
        console.error('Failed to load image:', error);
      }
    };

    loadImage();
  }, [imageDataUrl]);

  // Draw main canvas (full image with selection overlay)
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;

    if (!canvas || !ctx || !img || !displayDimensions) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.drawImage(img, 0, 0, displayDimensions.width, displayDimensions.height);

    // Draw selection overlay
    if (selection) {
      // Semi-transparent overlay on non-selected area
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';

      // Top
      ctx.fillRect(0, 0, canvas.width, selection.y);
      // Bottom
      ctx.fillRect(
        0,
        selection.y + selection.height,
        canvas.width,
        canvas.height - selection.y - selection.height,
      );
      // Left
      ctx.fillRect(0, selection.y, selection.x, selection.height);
      // Right
      ctx.fillRect(
        selection.x + selection.width,
        selection.y,
        canvas.width - selection.x - selection.width,
        selection.height,
      );

      // Draw selection border
      ctx.strokeStyle = isValidSelection ? '#0f9d58' : '#0066cc';
      ctx.lineWidth = 2;
      ctx.strokeRect(selection.x, selection.y, selection.width, selection.height);

      // Draw corner handles
      const handleSize = 10;
      ctx.fillStyle = isValidSelection ? '#0f9d58' : '#0066cc';

      // Top-left
      ctx.fillRect(
        selection.x - handleSize / 2,
        selection.y - handleSize / 2,
        handleSize,
        handleSize,
      );
      // Top-right
      ctx.fillRect(
        selection.x + selection.width - handleSize / 2,
        selection.y - handleSize / 2,
        handleSize,
        handleSize,
      );
      // Bottom-left
      ctx.fillRect(
        selection.x - handleSize / 2,
        selection.y + selection.height - handleSize / 2,
        handleSize,
        handleSize,
      );
      // Bottom-right
      ctx.fillRect(
        selection.x + selection.width - handleSize / 2,
        selection.y + selection.height - handleSize / 2,
        handleSize,
        handleSize,
      );
    }
  }, [selection, displayDimensions, isValidSelection]);

  // Draw live preview of selection (real-time thumbnail)
  const drawPreview = useCallback(() => {
    const previewCanvas = previewCanvasRef.current;
    const ctx = previewCanvas?.getContext('2d');
    const img = imageRef.current;

    if (!previewCanvas || !ctx || !img || !selection || !isValidSelection) return;

    // Calculate the actual image coordinates for the selection
    const sourceX = selection.x / scale;
    const sourceY = selection.y / scale;
    const sourceWidth = selection.width / scale;
    const sourceHeight = selection.height / scale;

    // Calculate preview canvas dimensions maintaining aspect ratio
    const aspectRatio = sourceWidth / sourceHeight;
    let canvasWidth = PREVIEW_MAX_SIZE;
    let canvasHeight = PREVIEW_MAX_SIZE;

    if (aspectRatio > 1) {
      canvasHeight = PREVIEW_MAX_SIZE / aspectRatio;
    } else {
      canvasWidth = PREVIEW_MAX_SIZE * aspectRatio;
    }

    // Set canvas size
    previewCanvas.width = Math.round(canvasWidth);
    previewCanvas.height = Math.round(canvasHeight);

    // Clear and draw the preview - disable smoothing for sharp QR codes
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvasWidth,
      canvasHeight,
    );
  }, [selection, isValidSelection, scale]);

  // Redraw main canvas when selection or image changes
  useEffect(() => {
    if (imageLoaded) {
      drawCanvas();
    }
  }, [imageLoaded, drawCanvas]);

  // Draw preview after selection is complete and canvas is mounted
  // Use setTimeout to ensure React has mounted the preview canvas
  useEffect(() => {
    if (isValidSelection && !isSelecting && imageLoaded) {
      const timeoutId = setTimeout(() => {
        drawPreview();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [isValidSelection, isSelecting, imageLoaded, selection, drawPreview]);

  // Get canvas-relative coordinates from mouse/touch event
  const getCanvasCoordinates = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  // Start selection
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (isProcessing) return;
    // Only preventDefault for mouse events (touch is handled by CSS touch-action: none)
    if (!('touches' in e)) {
      e.preventDefault();
    }

    const point = getCanvasCoordinates(e);
    setIsSelecting(true);
    setStartPoint(point);
    setSelection({
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    });
  };

  // Update selection while dragging
  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isSelecting || !startPoint || isProcessing) return;
    // Only preventDefault for mouse events (touch is handled by CSS touch-action: none)
    if (!('touches' in e)) {
      e.preventDefault();
    }

    const currentPoint = getCanvasCoordinates(e);

    // Calculate selection rectangle
    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);

    setSelection({ x, y, width, height });
  };

  // End selection
  const handleMouseUp = () => {
    setIsSelecting(false);
    setStartPoint(null);
  };

  // Clear selection to redraw
  const handleRedraw = () => {
    setSelection(null);
  };

  // Handle crop confirmation - sends full resolution crop area
  const handleCropConfirm = () => {
    if (!selection || !imageDimensions || !isValidSelection) {
      return;
    }

    // Convert display coordinates to actual image coordinates (full resolution)
    const actualCropArea: CropArea = {
      x: Math.round(selection.x / scale),
      y: Math.round(selection.y / scale),
      width: Math.round(selection.width / scale),
      height: Math.round(selection.height / scale),
    };

    // Ensure crop area is within image bounds
    actualCropArea.x = Math.max(0, actualCropArea.x);
    actualCropArea.y = Math.max(0, actualCropArea.y);
    actualCropArea.width = Math.min(actualCropArea.width, imageDimensions.width - actualCropArea.x);
    actualCropArea.height = Math.min(
      actualCropArea.height,
      imageDimensions.height - actualCropArea.y,
    );

    onCropConfirm(actualCropArea);
  };

  if (!displayDimensions) {
    return (
      <div className="w-full">
        <div className="text-center py-12 px-4">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
          <p className="text-xl text-gray-900 font-semibold">Cargando imagen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="text-center mb-6">
        <Search className="w-12 h-12 mx-auto mb-3 text-blue-600" />
        <h3 className="text-2xl font-bold text-gray-900 mb-3">Selecciona el código QR</h3>
        <p className="text-base text-gray-600 leading-relaxed max-w-xl mx-auto">
          No pudimos detectar el QR automáticamente. Dibuja un rectángulo alrededor del código QR de
          tu factura.
        </p>
      </div>

      {/* Main Selection Area */}
      <div
        className="relative flex justify-center items-center my-6 p-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 overflow-auto"
        ref={containerRef}
      >
        {/* Page Navigation - floating overlay */}
        {totalPages > 1 && onPageChange && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 py-2 px-4 bg-white/90 backdrop-blur-sm rounded-full shadow-md border border-gray-200">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isProcessing}
              className="p-1 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isProcessing}
              className="p-1 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={displayDimensions.width}
          height={displayDimensions.height}
          className={`cursor-crosshair rounded-lg shadow-md max-w-full h-auto ${isSelecting ? 'cursor-crosshair' : ''}`}
          style={{ touchAction: 'none' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        />

        {!selection && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 py-3 px-5 bg-black/75 text-white rounded-full text-sm font-medium whitespace-nowrap">
            <span>👆</span>
            <span>Haz clic y arrastra para seleccionar el área del QR</span>
          </div>
        )}
      </div>

      {/* Live Preview */}
      {isValidSelection && !isSelecting && (
        <div className="my-6 p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <CheckCircle className="w-6 h-6 text-blue-600" />
            <span className="text-base font-semibold text-blue-900">Área seleccionada</span>
          </div>
          <div className="flex justify-center items-center p-4 bg-white rounded-lg shadow-md">
            <canvas ref={previewCanvasRef} className="rounded max-w-full" />
          </div>
          <p className="text-sm text-gray-600 mt-4 mb-0 leading-relaxed">
            Esta es el área que se analizará. Asegúrate de que el QR esté completo y visible.
          </p>
        </div>
      )}

      {/* Warning for small selection */}
      {selection && !isValidSelection && !isSelecting && (
        <div className="text-center text-red-600 text-sm mt-4 p-3 bg-red-50 rounded-lg border border-red-200 flex items-center justify-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>
            La selección es muy pequeña. Haz una selección más grande que incluya todo el código QR.
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 justify-center mt-6 flex-wrap">
        {isValidSelection && !isSelecting && (
          <Button
            variant="primary"
            size="lg"
            onClick={handleCropConfirm}
            loading={isProcessing}
            icon={isProcessing ? undefined : <Search className="w-5 h-5" />}
            disabled={isProcessing}
          >
            {isProcessing ? 'Buscando QR...' : 'Buscar QR aquí'}
          </Button>
        )}
        {selection && !isSelecting && (
          <Button
            variant="secondary"
            size="lg"
            onClick={handleRedraw}
            icon={<RotateCcw className="w-5 h-5" />}
            disabled={isProcessing}
          >
            Nueva selección
          </Button>
        )}
        <Button
          variant="secondary"
          size="lg"
          onClick={onCancel}
          icon={<X className="w-5 h-5" />}
          disabled={isProcessing}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
};

export default QrManualSelector;
