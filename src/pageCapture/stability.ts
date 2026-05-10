export const STABILITY_THRESHOLD = 4;

export function frameDifference(
  prev: Uint8ClampedArray,
  curr: Uint8ClampedArray,
): number {
  if (prev.length !== curr.length) {
    throw new Error(`buffer length mismatch: ${prev.length} vs ${curr.length}`);
  }
  let sum = 0;
  for (let i = 0; i < curr.length; i++) {
    sum += Math.abs(curr[i]! - prev[i]!);
  }
  return sum / curr.length;
}
