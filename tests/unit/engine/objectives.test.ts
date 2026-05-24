import { describe, it, expect } from "vitest";
import {
  applyFind,
  findObjectiveByReferenceRegion,
  findObjectiveByTargetRegion,
  isObjectiveFound,
  isSceneComplete,
  ObjectiveError,
} from "@/engine/objectives";
import { hiddenObjectSceneSchema, type HiddenObjectScene } from "@/schema/game";

function makeScene(): HiddenObjectScene {
  return hiddenObjectSceneSchema.parse({
    id: "scene_1",
    kind: "hidden_object",
    title: "Library",
    image: { src: "images/scene-1.png", width: 1024, height: 768 },
    regions: [
      {
        id: "t_key",
        kind: "target",
        shape: "rect",
        rect: { x: 10, y: 10, w: 20, h: 20 },
      },
      {
        id: "r_key",
        kind: "reference",
        shape: "rect",
        rect: { x: 100, y: 600, w: 80, h: 80 },
      },
      {
        id: "t_book",
        kind: "target",
        shape: "rect",
        rect: { x: 50, y: 50, w: 30, h: 30 },
      },
      {
        id: "r_book",
        kind: "reference",
        shape: "rect",
        rect: { x: 200, y: 600, w: 80, h: 80 },
      },
      {
        id: "t_cup",
        kind: "target",
        shape: "rect",
        rect: { x: 80, y: 80, w: 25, h: 25 },
      },
      {
        id: "r_cup",
        kind: "reference",
        shape: "rect",
        rect: { x: 300, y: 600, w: 80, h: 80 },
      },
    ],
    objectives: [
      {
        id: "key",
        label: "Key",
        targetRegionId: "t_key",
        referenceRegionId: "r_key",
      },
      {
        id: "book",
        label: "Book",
        targetRegionId: "t_book",
        referenceRegionId: "r_book",
      },
      {
        id: "cup",
        label: "Cup",
        targetRegionId: "t_cup",
        referenceRegionId: "r_cup",
      },
    ],
    onComplete: { gotoSceneId: "end" },
  });
}

describe("findObjectiveByTargetRegion", () => {
  it("returns the objective whose targetRegionId matches", () => {
    const scene = makeScene();
    expect(findObjectiveByTargetRegion(scene, "t_key")?.id).toBe("key");
    expect(findObjectiveByTargetRegion(scene, "t_book")?.id).toBe("book");
    expect(findObjectiveByTargetRegion(scene, "t_cup")?.id).toBe("cup");
  });

  it("returns null if the region is a reference, not a target", () => {
    const scene = makeScene();
    expect(findObjectiveByTargetRegion(scene, "r_key")).toBeNull();
  });

  it("returns null if the region ID is unknown", () => {
    const scene = makeScene();
    expect(findObjectiveByTargetRegion(scene, "ghost")).toBeNull();
  });
});

describe("findObjectiveByReferenceRegion", () => {
  it("returns the objective whose referenceRegionId matches", () => {
    const scene = makeScene();
    expect(findObjectiveByReferenceRegion(scene, "r_key")?.id).toBe("key");
    expect(findObjectiveByReferenceRegion(scene, "r_book")?.id).toBe("book");
  });

  it("returns null if the region is a target, not a reference", () => {
    const scene = makeScene();
    expect(findObjectiveByReferenceRegion(scene, "t_key")).toBeNull();
  });
});

describe("isObjectiveFound", () => {
  it("returns true only when the objective id is present", () => {
    expect(isObjectiveFound(["a", "b"], "a")).toBe(true);
    expect(isObjectiveFound(["a", "b"], "b")).toBe(true);
    expect(isObjectiveFound(["a", "b"], "c")).toBe(false);
    expect(isObjectiveFound([], "a")).toBe(false);
  });
});

describe("isSceneComplete", () => {
  it("is true when every objective has been found", () => {
    const scene = makeScene();
    expect(isSceneComplete(scene, ["key", "book", "cup"])).toBe(true);
  });

  it("is false when any objective is missing", () => {
    const scene = makeScene();
    expect(isSceneComplete(scene, ["key", "book"])).toBe(false);
    expect(isSceneComplete(scene, [])).toBe(false);
  });

  it("ignores extra unrelated ids in the found list", () => {
    const scene = makeScene();
    expect(isSceneComplete(scene, ["key", "book", "cup", "noise"])).toBe(true);
  });
});

describe("applyFind", () => {
  it("appends a new objective id", () => {
    const scene = makeScene();
    const result = applyFind(scene, [], "key");
    expect(result.changed).toBe(true);
    expect(result.next).toEqual(["key"]);
  });

  it("is idempotent when the objective is already found", () => {
    const scene = makeScene();
    const result = applyFind(scene, ["key"], "key");
    expect(result.changed).toBe(false);
    expect(result.next).toEqual(["key"]);
  });

  it("preserves the order of earlier finds", () => {
    const scene = makeScene();
    const r1 = applyFind(scene, ["key", "book"], "cup");
    expect(r1.next).toEqual(["key", "book", "cup"]);
  });

  it("does not mutate the input array", () => {
    const scene = makeScene();
    const found = ["key"];
    const snapshot = [...found];
    applyFind(scene, found, "book");
    expect(found).toEqual(snapshot);
  });

  it("throws if the objective id is unknown to the scene", () => {
    const scene = makeScene();
    expect(() => applyFind(scene, [], "ghost")).toThrow(ObjectiveError);
  });

  it("supports every pairing in any order", () => {
    const scene = makeScene();
    const orderings = [
      ["key", "book", "cup"],
      ["cup", "key", "book"],
      ["book", "cup", "key"],
    ];
    for (const order of orderings) {
      let found: readonly string[] = [];
      for (const id of order) {
        const r = applyFind(scene, found, id);
        expect(r.changed).toBe(true);
        found = r.next;
      }
      expect(isSceneComplete(scene, found)).toBe(true);
    }
  });
});
