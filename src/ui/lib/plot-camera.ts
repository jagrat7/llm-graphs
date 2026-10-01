/** Preserve the cube's framing on the narrower dimension of a perspective viewport. */
export const PLOT_CAMERA_FOV = 38

export function plotCameraFov(aspect: number) {
  if (!Number.isFinite(aspect) || aspect <= 0) return PLOT_CAMERA_FOV
  const halfAngle = (PLOT_CAMERA_FOV * Math.PI) / 360
  return (Math.atan(Math.tan(halfAngle) / Math.min(1, aspect)) * 360) / Math.PI
}
