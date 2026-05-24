import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { axe } from "jest-axe";
import { A11yLayer } from "@/player/A11yLayer/A11yLayer";
import { usePlayerStore } from "@/state/playerStore";
import { init } from "@/engine/machine";
import { makeLoadedGame, helloGame } from "../_fixtures/game";

function resetStore() {
  usePlayerStore.setState({
    status: "idle",
    loaded: null,
    engineState: null,
    error: null,
  });
}

describe("<A11yLayer />", () => {
  beforeEach(resetStore);

  it("renders an aria-live status region", () => {
    render(<A11yLayer />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
  });

  it("announces the current scene on mount when a game is loaded", () => {
    const loaded = makeLoadedGame();
    usePlayerStore.setState({
      status: "ready",
      loaded,
      engineState: init(loaded.game),
      error: null,
    });
    render(<A11yLayer />);
    expect(screen.getByRole("status")).toHaveTextContent(/now showing: title/i);
  });

  it("announces scene transitions", () => {
    const loaded = makeLoadedGame();
    usePlayerStore.setState({
      status: "ready",
      loaded,
      engineState: init(loaded.game),
      error: null,
    });
    render(<A11yLayer />);
    act(() => {
      usePlayerStore.getState().dispatch({ type: "advance" });
    });
    expect(screen.getByRole("status")).toHaveTextContent(/now showing: intro/i);
  });

  it("announces game over when the engine reaches a null target", () => {
    const loaded = makeLoadedGame();
    usePlayerStore.setState({
      status: "ready",
      loaded,
      engineState: init(loaded.game),
      error: null,
    });
    render(<A11yLayer />);
    act(() => {
      usePlayerStore.getState().dispatch({ type: "advance" });
      usePlayerStore.getState().dispatch({ type: "advance" });
    });
    expect(screen.getByRole("status")).toHaveTextContent(/game over/i);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<A11yLayer />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
    // Touch helloGame so the fixture is exercised in the unit test surface.
    expect(helloGame.id).toBe("hello");
  });

  it("re-announces on a repeated hint request even when the same objective is targeted", async () => {
    const { gameSchema } = await import("@/schema/game");
    const game = gameSchema.parse({
      id: "hog2",
      version: 4,
      title: "HOG",
      startScene: "scene_1",
      scenes: [
        {
          id: "scene_1",
          kind: "hidden_object",
          title: "Find things",
          image: { src: "images/scene-1.png", width: 800, height: 600 },
          regions: [
            {
              id: "t_a",
              kind: "target",
              shape: "rect",
              rect: { x: 0, y: 0, w: 10, h: 10 },
            },
            {
              id: "r_a",
              kind: "reference",
              shape: "rect",
              rect: { x: 20, y: 0, w: 10, h: 10 },
            },
          ],
          objectives: [
            {
              id: "a",
              label: "Brass key",
              targetRegionId: "t_a",
              referenceRegionId: "r_a",
            },
          ],
          onComplete: { gotoSceneId: null },
        },
      ],
    });
    usePlayerStore.setState({
      status: "ready",
      loaded: {
        game,
        bundleBaseUrl: "./games/hog/",
        resolveAssetUrl: (p) => `./games/hog/${p}`,
      },
      engineState: init(game),
      error: null,
    });
    render(<A11yLayer />);
    act(() => {
      usePlayerStore.getState().dispatch({ type: "hint" });
    });
    const first = screen.getByRole("status").textContent;
    act(() => {
      usePlayerStore.getState().dispatch({ type: "hint" });
    });
    const second = screen.getByRole("status").textContent;
    expect(first).not.toBe(second);
    expect(second).toMatch(/brass key/i);
  });

  it("announces a hint request by objective label", async () => {
    const { gameSchema } = await import("@/schema/game");
    const game = gameSchema.parse({
      id: "hog",
      version: 4,
      title: "HOG",
      startScene: "scene_1",
      scenes: [
        {
          id: "scene_1",
          kind: "hidden_object",
          title: "Find things",
          image: { src: "images/scene-1.png", width: 800, height: 600 },
          regions: [
            {
              id: "t_a",
              kind: "target",
              shape: "rect",
              rect: { x: 0, y: 0, w: 10, h: 10 },
            },
            {
              id: "r_a",
              kind: "reference",
              shape: "rect",
              rect: { x: 20, y: 0, w: 10, h: 10 },
            },
          ],
          objectives: [
            {
              id: "a",
              label: "Brass key",
              targetRegionId: "t_a",
              referenceRegionId: "r_a",
            },
          ],
          onComplete: { gotoSceneId: null },
        },
      ],
    });
    usePlayerStore.setState({
      status: "ready",
      loaded: {
        game,
        bundleBaseUrl: "./games/hog/",
        resolveAssetUrl: (p) => `./games/hog/${p}`,
      },
      engineState: init(game),
      error: null,
    });
    render(<A11yLayer />);
    act(() => {
      usePlayerStore.getState().dispatch({ type: "hint" });
    });
    expect(screen.getByRole("status")).toHaveTextContent(/hint.*brass key/i);
  });
});
