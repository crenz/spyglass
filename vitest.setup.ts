import "@testing-library/jest-dom/vitest";
import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

// jsdom does not implement canvas. Provide a no-op 2D context stub so libraries
// like Konva can construct without throwing. Actual canvas rendering is covered
// by Playwright e2e tests in a real browser.
if (
  typeof HTMLCanvasElement !== "undefined" &&
  !(HTMLCanvasElement.prototype as { __spyglassCanvasStub?: true })
    .__spyglassCanvasStub
) {
  const noop = () => undefined;
  const stubContext = () => {
    const state: Record<string | symbol, unknown> = {};
    return new Proxy(state, {
      get: (target, prop) => {
        if (prop in target) return target[prop];
        if (prop === "canvas") return undefined;
        if (prop === "getImageData") {
          return () => ({ data: new Uint8ClampedArray(4) });
        }
        if (prop === "measureText") {
          return () => ({ width: 0 });
        }
        if (prop === "createImageData") {
          return (w: number = 1, h: number = 1) => ({
            data: new Uint8ClampedArray(w * h * 4),
            width: w,
            height: h,
          });
        }
        if (prop === "createPattern") return () => null;
        if (
          prop === "createLinearGradient" ||
          prop === "createRadialGradient"
        ) {
          return () => ({ addColorStop: noop });
        }
        return noop;
      },
      set: (target, prop, value) => {
        target[prop] = value;
        return true;
      },
    });
  };
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: () => stubContext(),
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
    configurable: true,
    value: () => "",
  });
  (
    HTMLCanvasElement.prototype as { __spyglassCanvasStub?: true }
  ).__spyglassCanvasStub = true;
}

if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    constructor(_cb: ResizeObserverCallback) {
      void _cb;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (
    globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }
  ).ResizeObserver = ResizeObserverStub;
}

afterEach(() => {
  cleanup();
});
