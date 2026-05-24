import { describe, it, expect } from "vitest";
import { resolveSplashAdvance } from "@/engine/scenes/splash";
import { splashSceneSchema } from "@/schema/game";

describe("resolveSplashAdvance", () => {
  it("returns the onAdvance.gotoSceneId for a click-advance splash", () => {
    const scene = splashSceneSchema.parse({
      id: "title",
      kind: "splash",
      image: "images/title.png",
      advance: { kind: "click" },
      onAdvance: { gotoSceneId: "intro" },
    });
    expect(resolveSplashAdvance(scene)).toBe("intro");
  });

  it("returns null when the splash ends the game", () => {
    const scene = splashSceneSchema.parse({
      id: "end",
      kind: "splash",
      image: "images/end.png",
      advance: { kind: "key" },
      onAdvance: { gotoSceneId: null },
    });
    expect(resolveSplashAdvance(scene)).toBeNull();
  });

  it("does not depend on the advance kind", () => {
    const a = splashSceneSchema.parse({
      id: "a",
      kind: "splash",
      image: "images/a.png",
      advance: { kind: "click" },
      onAdvance: { gotoSceneId: "b" },
    });
    const b = splashSceneSchema.parse({
      id: "a",
      kind: "splash",
      image: "images/a.png",
      advance: { kind: "timeout", timeoutMs: 2000 },
      onAdvance: { gotoSceneId: "b" },
    });
    expect(resolveSplashAdvance(a)).toBe(resolveSplashAdvance(b));
  });
});
