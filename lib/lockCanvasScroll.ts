/**
 * react-three-fiber wraps every <canvas> in two auto-generated divs, the outer one
 * styled `overflow: hidden`. `overflow: hidden` still accepts a programmatic/focus-driven
 * scrollLeft — and drei `<Html>` labels can momentarily land far outside the viewport
 * during a camera fly-to, which makes that div scrollable. Clicking such a label then
 * triggers the browser's default "scroll the focused element into view", shifting the
 * whole canvas sideways and leaving a black strip where it no longer covers the viewport.
 * `overflow: clip` (unlike `hidden`) never accepts a scroll offset, so it removes the
 * failure mode outright instead of just resetting it after the fact.
 */
export function lockCanvasScroll(canvas: HTMLCanvasElement) {
  const wrapper = canvas.parentElement?.parentElement;
  if (wrapper) wrapper.style.overflow = 'clip';
}
