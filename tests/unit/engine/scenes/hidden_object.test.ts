import { describe, it, expect } from "vitest";
import { resolveHiddenObjectComplete } from "@/engine/scenes/hidden_object";
import { hiddenObjectSceneSchema } from "@/schema/game";

const sceneWithGoto = hiddenObjectSceneSchema.parse({
  id: "scene_1",
  kind: "hidden_object",
  image: { src: "images/scene-1.png", width: 1024, height: 768 },
  regions: [
    {
      id: "t1",
      kind: "target",
      shape: "rect",
      rect: { x: 0, y: 0, w: 10, h: 10 },
    },
    {
      id: "r1",
      kind: "reference",
      shape: "rect",
      rect: { x: 20, y: 0, w: 10, h: 10 },
    },
  ],
  objectives: [
    { id: "o1", label: "L", targetRegionId: "t1", referenceRegionId: "r1" },
  ],
  onComplete: { gotoSceneId: "next" },
});

const sceneWithNull = hiddenObjectSceneSchema.parse({
  id: "scene_end",
  kind: "hidden_object",
  image: { src: "images/scene-1.png", width: 1024, height: 768 },
  regions: [
    {
      id: "t1",
      kind: "target",
      shape: "rect",
      rect: { x: 0, y: 0, w: 10, h: 10 },
    },
    {
      id: "r1",
      kind: "reference",
      shape: "rect",
      rect: { x: 20, y: 0, w: 10, h: 10 },
    },
  ],
  objectives: [
    { id: "o1", label: "L", targetRegionId: "t1", referenceRegionId: "r1" },
  ],
  onComplete: { gotoSceneId: null },
});

describe("resolveHiddenObjectComplete", () => {
  it("returns the onComplete.gotoSceneId", () => {
    expect(resolveHiddenObjectComplete(sceneWithGoto)).toBe("next");
  });

  it("returns null when the scene ends the game", () => {
    expect(resolveHiddenObjectComplete(sceneWithNull)).toBeNull();
  });
});
