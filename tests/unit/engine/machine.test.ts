import { describe, it, expect } from "vitest";
import { init, dispatch, currentScene, EngineError } from "@/engine/machine";
import { gameSchema, type Game } from "@/schema/game";

const game: Game = gameSchema.parse({
  id: "hello",
  version: 1,
  title: "Hello",
  startScene: "title",
  scenes: [
    {
      id: "title",
      kind: "splash",
      title: "Title",
      image: "images/title.png",
      advance: { kind: "click" },
      onAdvance: { gotoSceneId: "intro" },
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
    expect(state2.currentSceneId).toBe("intro");
    expect(state2.history).toEqual(["title"]);
  });

  it("walks multiple scenes", () => {
    let state = init(game);
    state = dispatch(game, state, { type: "advance" });
    expect(state.currentSceneId).toBe("intro");
    state = dispatch(game, state, { type: "advance" });
    expect(state.currentSceneId).toBe("end");
    expect(state.history).toEqual(["title", "intro"]);
  });

  it("marks the game done when advancing into a null target", () => {
    let state = init(game);
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
