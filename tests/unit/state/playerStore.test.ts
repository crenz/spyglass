import { describe, it, expect, beforeEach } from "vitest";
import { usePlayerStore } from "@/state/playerStore";
import type { LoadedGame } from "@/loaders/types";
import { gameSchema } from "@/schema/game";

const game = gameSchema.parse({
  id: "hello",
  version: 3,
  title: "Hello",
  startScene: "title",
  scenes: [
    {
      id: "title",
      kind: "splash",
      image: "images/title.png",
      advance: { kind: "click" },
      onAdvance: { gotoSceneId: "intro" },
    },
    {
      id: "intro",
      kind: "splash",
      image: "images/intro.png",
      advance: { kind: "key" },
      onAdvance: { gotoSceneId: null },
    },
  ],
});

const loaded: LoadedGame = {
  game,
  bundleBaseUrl: "./games/hello/",
  resolveAssetUrl: (path) => `./games/hello/${path}`,
};

describe("usePlayerStore", () => {
  beforeEach(() => {
    usePlayerStore.setState({
      status: "idle",
      loaded: null,
      engineState: null,
      error: null,
    });
  });

  it("starts idle", () => {
    expect(usePlayerStore.getState().status).toBe("idle");
  });

  it("loads a game and enters ready", async () => {
    await usePlayerStore.getState().loadGame(async () => loaded);
    const state = usePlayerStore.getState();
    expect(state.status).toBe("ready");
    expect(state.engineState?.currentSceneId).toBe("title");
  });

  it("dispatches advance after a successful load", async () => {
    await usePlayerStore.getState().loadGame(async () => loaded);
    usePlayerStore.getState().dispatch({ type: "advance" });
    expect(usePlayerStore.getState().engineState?.currentSceneId).toBe("intro");
  });

  it("records an error message when loading fails", async () => {
    await usePlayerStore.getState().loadGame(async () => {
      throw new Error("boom");
    });
    const state = usePlayerStore.getState();
    expect(state.status).toBe("error");
    expect(state.error).toBe("boom");
  });

  it("reset returns to the start scene", async () => {
    await usePlayerStore.getState().loadGame(async () => loaded);
    usePlayerStore.getState().dispatch({ type: "advance" });
    usePlayerStore.getState().reset();
    expect(usePlayerStore.getState().engineState?.currentSceneId).toBe("title");
  });

  it("dispatch is a no-op before a game loads", () => {
    usePlayerStore.getState().dispatch({ type: "advance" });
    expect(usePlayerStore.getState().engineState).toBeNull();
  });
});
