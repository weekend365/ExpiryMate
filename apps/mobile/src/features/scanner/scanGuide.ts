import { spacing } from "../../shared/theme";

/** Vertical size of the scan cutout in the overlay. */
export const SCAN_FRAME_HEIGHT = spacing.xxxl + spacing.xxxl + spacing.xl;

/** Horizontal inset of the cutout from overlay edges. */
export const SCAN_FRAME_SIDE_INSET = spacing.lg;

/** Padding inside the frame for the moving scan line. */
export const SCAN_LINE_INSET = spacing.md;

/** Scan line thickness. */
export const SCAN_LINE_HEIGHT = spacing.xxs;

/** Distance the scan line travels inside the frame. */
export const SCAN_LINE_TRAVEL =
  SCAN_FRAME_HEIGHT - SCAN_LINE_INSET * 2 - SCAN_LINE_HEIGHT;

export type GuideFrameLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImageSize = {
  width: number;
  height: number;
};

export type ImageFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Map the on-screen guide cutout to a rect in photo pixels.
 * Uses window-relative ratios as a practical approximation of the camera preview.
 */
export function guideFrameToImageRect(
  guide: GuideFrameLayout,
  image: ImageSize,
  windowSize: ImageSize,
): ImageFrame {
  const left = Math.round((guide.x / windowSize.width) * image.width);
  const top = Math.round((guide.y / windowSize.height) * image.height);
  const width = Math.round((guide.width / windowSize.width) * image.width);
  const height = Math.round((guide.height / windowSize.height) * image.height);

  const clampedLeft = clamp(left, 0, Math.max(image.width - 1, 0));
  const clampedTop = clamp(top, 0, Math.max(image.height - 1, 0));
  const clampedWidth = clamp(width, 1, image.width - clampedLeft);
  const clampedHeight = clamp(height, 1, image.height - clampedTop);

  return {
    left: clampedLeft,
    top: clampedTop,
    width: clampedWidth,
    height: clampedHeight,
  };
}

/** Whether a text/barcode box center sits inside the guide rect (image pixels). */
export function isImageFrameCenterInGuide(
  frame: ImageFrame | undefined,
  guideRect: ImageFrame | null,
): boolean {
  if (!guideRect || !frame || frame.width <= 0 || frame.height <= 0) {
    return true;
  }

  const centerX = frame.left + frame.width / 2;
  const centerY = frame.top + frame.height / 2;
  const padX = guideRect.width * 0.08;
  const padY = guideRect.height * 0.08;

  return (
    centerX >= guideRect.left - padX &&
    centerX <= guideRect.left + guideRect.width + padX &&
    centerY >= guideRect.top - padY &&
    centerY <= guideRect.top + guideRect.height + padY
  );
}

/**
 * Whether a barcode center (from expo-camera bounds) sits inside the guide cutout.
 * Accepts when bounds are missing so devices without coordinates still work.
 */
export function isBarcodeCenterInGuide(
  bounds:
    | {
        origin: { x: number; y: number };
        size: { width: number; height: number };
      }
    | undefined,
  guide: GuideFrameLayout | null,
  windowSize: ImageSize,
): boolean {
  if (!guide || !bounds?.size?.width || !bounds?.size?.height) {
    return true;
  }

  let centerX = bounds.origin.x + bounds.size.width / 2;
  let centerY = bounds.origin.y + bounds.size.height / 2;

  // Normalized 0–1 coordinates (common on some platforms).
  if (
    bounds.origin.x >= 0 &&
    bounds.origin.x <= 1 &&
    bounds.origin.y >= 0 &&
    bounds.origin.y <= 1 &&
    bounds.size.width <= 1 &&
    bounds.size.height <= 1
  ) {
    centerX *= windowSize.width;
    centerY *= windowSize.height;
  }

  const padX = guide.width * 0.08;
  const padY = guide.height * 0.08;

  return (
    centerX >= guide.x - padX &&
    centerX <= guide.x + guide.width + padX &&
    centerY >= guide.y - padY &&
    centerY <= guide.y + guide.height + padY
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
