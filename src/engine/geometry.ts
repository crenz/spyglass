export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Circle {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

export type PolygonPoints = readonly (readonly [number, number])[];

export function pointInRect(rect: Rect, x: number, y: number): boolean {
  return (
    x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  );
}

export function pointInCircle(circle: Circle, x: number, y: number): boolean {
  const dx = x - circle.cx;
  const dy = y - circle.cy;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

// Even-odd ray-casting. Counts how many polygon edges a horizontal ray cast to
// the right from (x, y) crosses; odd ⇒ inside.
export function pointInPolygon(
  points: PolygonPoints,
  x: number,
  y: number,
): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!;
    const b = points[j]!;
    const [xi, yi] = a;
    const [xj, yj] = b;
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
