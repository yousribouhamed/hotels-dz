// The Zalumo symbol (the two-lobed mark of the logo) as path data in a unit box, so it can be drawn
// sharp at any size, including when the opening animation grows it past the edges of the screen.
// Same shape as ZalumoMark in the iOS app (Brand.swift).

/** Width ÷ height of the mark. */
export const MARK_ASPECT = 1.51269;

/** Colours of the opening animation: like the app icon, a forest mark on lime. */
export const SPLASH_LIME = '#BFFF00';
export const SPLASH_FOREST = '#367901';

const SEGMENTS: (string | number)[][] = [["M", 0.99914, 0.66351], ["C", 1.01175, 0.53168, 0.88485, 0.43891, 0.70314, 0.43399], ["C", 0.77752, 0.37538, 0.82655, 0.30316, 0.83358, 0.22974], ["C", 0.84827, 0.0762, 0.67375, -0.02434, 0.44381, 0.00513], ["C", 0.21386, 0.0346, 0.01556, 0.18296, 0.00086, 0.33648], ["C", -0.01175, 0.46832, 0.11515, 0.56109, 0.29686, 0.56601], ["C", 0.22248, 0.62462, 0.17344, 0.69685, 0.16642, 0.77026], ["C", 0.15173, 0.9238, 0.32625, 1.02434, 0.55619, 0.99487], ["C", 0.78614, 0.9654, 0.98444, 0.81704, 0.99914, 0.66351], ["Z"]];

/** SVG path data for the mark `width` wide, centred on (cx, cy). Empty when the width is 0. */
export function markPath(cx: number, cy: number, width: number): string {
  if (width <= 0) return '';
  const h = width / MARK_ASPECT;
  const x0 = cx - width / 2;
  const y0 = cy - h / 2;
  const x = (v: number) => (x0 + v * width).toFixed(2);
  const y = (v: number) => (y0 + v * h).toFixed(2);
  return SEGMENTS.map(([cmd, ...n]) => {
    const v = n as number[];
    if (cmd === 'M') return `M${x(v[0])} ${y(v[1])}`;
    if (cmd === 'C') return `C${x(v[0])} ${y(v[1])} ${x(v[2])} ${y(v[3])} ${x(v[4])} ${y(v[5])}`;
    return 'Z';
  }).join(' ');
}

/** A rectangle with a mark-shaped hole (fill with fillRule="evenodd"): a cover that reveals what is under the mark. */
export function coverWithMarkHole(w: number, h: number, holeWidth: number): string {
  return `M-4 -4 H${w + 4} V${h + 4} H-4 Z ` + markPath(w / 2, h / 2, holeWidth);
}
