import { describe, it, expect } from "vitest";
import { init, dispatch, currentScene, EngineError } from "@/engine/machine";
import { gameSchema, type Game } from "@/schema/game";

const game: Game = gameSchema.parse({
  id: "hello",
  version: 3,
  title: "Hello",
  startScene: "title",
  scenes: [
    {
      id: "title",
      kind: "splash",
      title: "Title",
      image: "images/title.png",
      advance: { kind: "click" },
      onAdvance: { gotoSceneId: "intro_video" },
    },
    {
      id: "intro_video",
      kind: "cutscene",
      title: "Intro",
      video: "videos/intro.mp4",
      skipPolicy: { kind: "always" },
      onEnd: { gotoSceneId: "intro" },
    },
    {
      id: "intro",
      kind: "splash",
      title: "Intro",
      image: "images/intro.png",
      advance: { kind: "key" },
      onAdvance: { gotoSceneId: "end" },
    },
    {
      id: "end",
      kind: "splash",
      title: "End",
      image: "images/end.png",
      advance: { kind: "timeout", timeoutMs: 5000 },
      onAdvance: { gotoSceneId: null },
    },
  ],
});

const hogGame: Game = gameSchema.parse({
  id: "hog",
  version: 3,
  title: "HOG",
  startScene: "scene_1",
  scenes: [
    {
      id: "scene_1",
      kind: "hidden_object",
      title: "Find things",
      image: { src: "images/scene-1.png", width: 1024, height: 768 },
      regions: [
        { id: "t_a", shape: "rect", rect: { x: 10, y: 10, w: 20, h: 20 } },
        { id: "r_a", shape: "rect", rect: { x: 100, y: 600, w: 50, h: 50 } },
        { id: "t_b", shape: "rect", rect: { x: 50, y: 50, w: 30, h: 30 } },
        { id: "r_b", shape: "rect", rect: { x: 200, y: 600, w: 50, h: 50 } },
      ],
      objectives: [
        {
          id: "a",
          label: "A",
          targetRegionId: "t_a",
          referenceRegionId: "r_a",
        },
        {
          id: "b",
          label: "B",
          targetRegionId: "t_b",
          referenceRegionId: "r_b",
        },
      ],
      onComplete: { gotoSceneId: "end" },
    },
    {
      id: "end",
      kind: "splash",
      title: "End",
      image: "images/end.png",
      advance: { kind: "click" },
      onAdvance: { gotoSceneId: null },
    },
  ],
});

describe("engine.init", () => {
  it("starts on the game.startScene", () => {
    const state = init(game);
    expect(state.currentSceneId).toBe("title");
    expect(state.history).toEqual([]);
    expect(state.done).toBe(false);
  });

  it("throws if startScene is unknown", () => {
    const bogus = { ...game, startScene: "ghost" } as Game;
    expect(() => init(bogus)).toThrow(EngineError);
  });
});

describe("engine.dispatch", () => {
  it("advances a splash scene to its onAdvance target", () => {
    const state1 = init(game);
    const state2 = dispatch(game, state1, { type: "advance" });
    expect(state2.currentSceneId).toBe("intro_video");
    expect(state2.history).toEqual(["title"]);
  });

  it("advances a cutscene to its onEnd target", () => {
    let state = init(game);
    state = dispatch(game, state, { type: "advance" });
    expect(state.currentSceneId).toBe("intro_video");
    state = dispatch(game, state, { type: "advance" });
    expect(state.currentSceneId).toBe("intro");
  });

  it("walks multiple scenes", () => {
    let state = init(game);
    state = dispatch(game, state, { type: "advance" });
    state = dispatch(game, state, { type: "advance" });
    expect(state.currentSceneId).toBe("intro");
    state = dispatch(game, state, { type: "advance" });
    expect(state.currentSceneId).toBe("end");
    expect(state.history).toEqual(["title", "intro_video", "intro"]);
  });

  it("marks the game done when advancing into a null target", () => {
    let state = init(game);
    state = dispatch(game, state, { type: "advance" });
    state = dispatch(game, state, { type: "advance" });
    state = dispatch(game, state, { type: "advance" });
    state = dispatch(game, state, { type: "advance" });
    expect(state.done).toBe(true);
    expect(state.currentSceneId).toBe("end");
  });

  it("is a no-op after done", () => {
    let state = init(game);
    state = dispatch(game, state, { type: "advance" });
    state = dispatch(game, state, { type: "advance" });
    state = dispatch(game, state, { type: "advance" });
    state = dispatch(game, state, { type: "advance" });
    const before = state;
    const after = dispatch(game, before, { type: "advance" });
    expect(after).toBe(before);
  });

  it("jumps to an explicit goto target", () => {
    const state1 = init(game);
    const state2 = dispatch(game, state1, { type: "goto", sceneId: "end" });
    expect(state2.currentSceneId).toBe("end");
    expect(state2.history).toEqual(["title"]);
  });

  it("goto null marks done", () => {
    const state1 = init(game);
    const state2 = dispatch(game, state1, { type: "goto", sceneId: null });
    expect(state2.done).toBe(true);
  });

  it("throws on goto to unknown scene", () => {
    const state = init(game);
    expect(() =>
      dispatch(game, state, { type: "goto", sceneId: "ghost" }),
    ).toThrow(EngineError);
  });

  it("does not mutate prior states", () => {
    const state1 = init(game);
    const snapshot = JSON.stringify(state1);
    dispatch(game, state1, { type: "advance" });
    expect(JSON.stringify(state1)).toBe(snapshot);
  });
});

describe("engine.currentScene", () => {
  it("returns the current scene object", () => {
    const state = init(game);
    expect(currentScene(game, state).id).toBe("title");
  });
});

describe("engine.dispatch — hidden_object", () => {
  it("init seeds an empty foundObjectiveIds map", () => {
    const state = init(hogGame);
    expect(state.currentSceneId).toBe("scene_1");
    expect(state.hiddenObject).toEqual({});
  });

  it("records a find under the current HOG scene id", () => {
    let state = init(hogGame);
    state = dispatch(hogGame, state, { type: "find", objectiveId: "a" });
    expect(state.hiddenObject.scene_1?.foundObjectiveIds).toEqual(["a"]);
    expect(state.currentSceneId).toBe("scene_1");
  });

  it("is idempotent for the same objective", () => {
    let state = init(hogGame);
    state = dispatch(hogGame, state, { type: "find", objectiveId: "a" });
    const before = state;
    state = dispatch(hogGame, state, { type: "find", objectiveId: "a" });
    expect(state).toBe(before);
  });

  it("auto-advances when the last objective is found", () => {
    let state = init(hogGame);
    state = dispatch(hogGame, state, { type: "find", objectiveId: "a" });
    expect(state.currentSceneId).toBe("scene_1");
    state = dispatch(hogGame, state, { type: "find", objectiveId: "b" });
    expect(state.currentSceneId).toBe("end");
    expect(state.history).toEqual(["scene_1"]);
  });

  it("preserves foundObjectiveIds in state.hiddenObject after auto-advance", () => {
    let state = init(hogGame);
    state = dispatch(hogGame, state, { type: "find", objectiveId: "a" });
    state = dispatch(hogGame, state, { type: "find", objectiveId: "b" });
    expect(state.hiddenObject.scene_1?.foundObjectiveIds).toEqual(["a", "b"]);
  });

  it("throws if find dispatches outside an HOG scene", () => {
    const state = init(game);
    expect(() =>
      dispatch(game, state, { type: "find", objectiveId: "a" }),
    ).toThrow(EngineError);
  });

  it("throws if the objective id is unknown to the current scene", () => {
    const state = init(hogGame);
    expect(() =>
      dispatch(hogGame, state, { type: "find", objectiveId: "ghost" }),
    ).toThrow();
  });

  it("ignores find after the game is done", () => {
    let state = init(hogGame);
    state = dispatch(hogGame, state, { type: "find", objectiveId: "a" });
    state = dispatch(hogGame, state, { type: "find", objectiveId: "b" });
    // Auto-advance moved us to splash "end"; advance to null.
    state = dispatch(hogGame, state, { type: "advance" });
    expect(state.done).toBe(true);
    const before = state;
    state = dispatch(hogGame, state, { type: "find", objectiveId: "a" });
    expect(state).toBe(before);
  });

  it("ends the game when onComplete.gotoSceneId is null", () => {
    const game: Game = gameSchema.parse({
      id: "hog2",
      version: 3,
      title: "HOG2",
      startScene: "only",
      scenes: [
        {
          id: "only",
          kind: "hidden_object",
          image: { src: "images/x.png", width: 100, height: 100 },
          regions: [
            { id: "t1", shape: "rect", rect: { x: 0, y: 0, w: 10, h: 10 } },
            { id: "r1", shape: "rect", rect: { x: 20, y: 0, w: 10, h: 10 } },
          ],
          objectives: [
            {
              id: "o1",
              label: "L",
              targetRegionId: "t1",
              referenceRegionId: "r1",
            },
          ],
          onComplete: { gotoSceneId: null },
        },
      ],
    });
    let state = init(game);
    state = dispatch(game, state, { type: "find", objectiveId: "o1" });
    expect(state.done).toBe(true);
  });

  it("does not mutate prior states", () => {
    const state1 = init(hogGame);
    const snapshot = JSON.stringify(state1);
    dispatch(hogGame, state1, { type: "find", objectiveId: "a" });
    expect(JSON.stringify(state1)).toBe(snapshot);
  });
});
