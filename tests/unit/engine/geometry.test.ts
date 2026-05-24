import { describe, it, expect } from "vitest";
import { pointInCircle, pointInPolygon, pointInRect } from "@/engine/geometry";

describe("pointInRect", () => {
  const rect = { x: 10, y: 20, w: 30, h: 40 };

  it("is true at the top-left corner", () => {
    expect(pointInRect(rect, 10, 20)).toBe(true);
  });

  it("is true at the center", () => {
    expect(pointInRect(rect, 25, 40)).toBe(true);
  });

  it("is false past the right edge", () => {
    expect(pointInRect(rect, 41, 30)).toBe(false);
  });

  it("is false past the bottom edge", () => {
    expect(pointInRect(rect, 25, 61)).toBe(false);
  });

  it("is true on the right edge (inclusive)", () => {
    expect(pointInRect(rect, 40, 40)).toBe(true);
  });

  it("is true on the bottom edge (inclusive)", () => {
    expect(pointInRect(rect, 25, 60)).toBe(true);
  });

  it("is false to the left of the rect", () => {
    expect(pointInRect(rect, 9, 30)).toBe(false);
  });

  it("is false above the rect", () => {
    expect(pointInRect(rect, 25, 19)).toBe(false);
  });
});

describe("pointInCircle", () => {
  const circle = { cx: 100, cy: 100, r: 50 };

  it("is true at the exact center", () => {
    expect(pointInCircle(circle, 100, 100)).toBe(true);
  });

  it("is true just inside the boundary", () => {
    expect(pointInCircle(circle, 100, 149)).toBe(true);
  });

  it("is true on the boundary (inclusive)", () => {
    expect(pointInCircle(circle, 150, 100)).toBe(true);
  });

  it("is false just outside the boundary", () => {
    expect(pointInCircle(circle, 100, 151)).toBe(false);
  });

  it("is false outside the bounding box", () => {
    expect(pointInCircle(circle, 200, 200)).toBe(false);
  });

  it("is false at the negative x of the bounding box outside the circle", () => {
    // Bounding box corner (50, 50) but distance from (100,100) is ~70.7 > 50.
    expect(pointInCircle(circle, 50, 50)).toBe(false);
  });
});

describe("pointInPolygon", () => {
  // A square polygon — same as a rect but expressed as points.
  const square = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ] satisfies [number, number][];

  it("is true in the interior of a square", () => {
    expect(pointInPolygon(square, 50, 50)).toBe(true);
  });

  it("is false outside a square", () => {
    expect(pointInPolygon(square, 150, 50)).toBe(false);
    expect(pointInPolygon(square, -1, 50)).toBe(false);
    expect(pointInPolygon(square, 50, 150)).toBe(false);
  });

  // A non-convex (arrow-down) polygon: outer triangle with a notch carved
  // up through the bottom centre.
  const notched = [
    [50, 0],
    [100, 100],
    [50, 50],
    [0, 100],
  ] satisfies [number, number][];

  it("is true in the convex part of a concave polygon", () => {
    expect(pointInPolygon(notched, 50, 25)).toBe(true);
  });

  it("is false in the concave notch of a non-convex polygon", () => {
    // (50, 75) sits inside the bounding box but in the carved-out notch.
    expect(pointInPolygon(notched, 50, 75)).toBe(false);
  });

  // A triangle.
  const triangle = [
    [0, 0],
    [100, 0],
    [50, 100],
  ] satisfies [number, number][];

  it("is true at the centroid of a triangle", () => {
    expect(pointInPolygon(triangle, 50, 33)).toBe(true);
  });

  it("is false outside a triangle but inside its bounding box", () => {
    expect(pointInPolygon(triangle, 5, 90)).toBe(false);
    expect(pointInPolygon(triangle, 95, 90)).toBe(false);
  });
});
