import { describe, it, expect } from "vitest";
import { resolveCutsceneEnd } from "@/engine/scenes/cutscene";
import { cutsceneSceneSchema } from "@/schema/game";

describe("resolveCutsceneEnd", () => {
  it("returns the onEnd.gotoSceneId for a cutscene", () => {
    const scene = cutsceneSceneSchema.parse({
      id: "intro_video",
      kind: "cutscene",
      video: "videos/intro.mp4",
      skipPolicy: { kind: "always" },
      onEnd: { gotoSceneId: "intro" },
    });
    expect(resolveCutsceneEnd(scene)).toBe("intro");
  });

  it("returns null when the cutscene ends the game", () => {
    const scene = cutsceneSceneSchema.parse({
      id: "end_video",
      kind: "cutscene",
      video: "videos/end.mp4",
      skipPolicy: { kind: "always" },
      onEnd: { gotoSceneId: null },
    });
    expect(resolveCutsceneEnd(scene)).toBeNull();
  });

  it("does not depend on the skipPolicy", () => {
    const a = cutsceneSceneSchema.parse({
      id: "a",
      kind: "cutscene",
      video: "videos/a.mp4",
      skipPolicy: { kind: "always" },
      onEnd: { gotoSceneId: "b" },
    });
    const b = cutsceneSceneSchema.parse({
      id: "a",
      kind: "cutscene",
      video: "videos/a.mp4",
      skipPolicy: { kind: "after-ms", afterMs: 2000 },
      onEnd: { gotoSceneId: "b" },
    });
    expect(resolveCutsceneEnd(a)).toBe(resolveCutsceneEnd(b));
  });
});
