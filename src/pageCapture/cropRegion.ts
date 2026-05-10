export interface VideoLayout {
  videoWidth: number;
  videoHeight: number;
  rect: { left: number; top: number; width: number; height: number };
}

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export function computeCropRect(
  video: VideoLayout,
  overlay: ScreenRect,
): CropRect | null {
  const { videoWidth, videoHeight, rect } = video;
  if (videoWidth <= 0 || videoHeight <= 0 || rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  // object-fit: contain → letterbox to preserve aspect
  const videoAspect = videoWidth / videoHeight;
  const displayAspect = rect.width / rect.height;

  let contentLeft: number;
  let contentTop: number;
  let contentWidth: number;
  let contentHeight: number;
  if (videoAspect > displayAspect) {
    // Video wider than display container: horizontal bars (letterbox top/bottom)
    contentWidth = rect.width;
    contentHeight = rect.width / videoAspect;
    contentLeft = rect.left;
    contentTop = rect.top + (rect.height - contentHeight) / 2;
  } else {
    // Video taller (or equal): vertical bars (pillarbox left/right)
    contentHeight = rect.height;
    contentWidth = rect.height * videoAspect;
    contentLeft = rect.left + (rect.width - contentWidth) / 2;
    contentTop = rect.top;
  }

  // Intersect overlay with content rect
  const ix = Math.max(overlay.left, contentLeft);
  const iy = Math.max(overlay.top, contentTop);
  const irx = Math.min(overlay.left + overlay.width, contentLeft + contentWidth);
  const iry = Math.min(overlay.top + overlay.height, contentTop + contentHeight);
  const iw = irx - ix;
  const ih = iry - iy;
  if (iw <= 0 || ih <= 0) return null;

  // Map screen-space rect to camera-pixel coords
  const scaleX = videoWidth / contentWidth;
  const scaleY = videoHeight / contentHeight;

  return {
    sx: (ix - contentLeft) * scaleX,
    sy: (iy - contentTop) * scaleY,
    sw: iw * scaleX,
    sh: ih * scaleY,
  };
}

// Read DOM and produce a VideoLayout. Returns null if video metadata not yet loaded.
export function readVideoLayout(video: HTMLVideoElement): VideoLayout | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const rect = video.getBoundingClientRect();
  return {
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
  };
}

export function readOverlayRect(overlay: SVGSVGElement): ScreenRect | null {
  // Use the inner rect (the actual A4 guide) rather than the full SVG box,
  // so we honor the 2-unit inset around the rect.
  const inner = overlay.querySelector('rect');
  const target: Element = inner ?? overlay;
  const rect = target.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}
