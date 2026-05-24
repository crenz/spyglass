import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { HiddenObjectScene } from "@/player/HiddenObjectScene/HiddenObjectScene";
import { usePlayerStore } from "@/state/playerStore";
import { init } from "@/engine/machine";
import {
  gameSchema,
  type Game,
  type HiddenObjectScene as HiddenObjectSceneType,
} from "@/schema/game";
import type { LoadedGame } from "@/loaders/types";

const fixtureGame: Game = gameSchema.parse({
  id: "hog_fixture",
  version: 3,
  title: "HOG fixture",
  startScene: "hog",
  scenes: [
    {
      id: "hog",
      kind: "hidden_object",
      title: "The library",
      image: { src: "images/scene.png", width: 800, height: 600 },
      regions: [
        { id: "t_a", shape: "rect", rect: { x: 10, y: 10, w: 40, h: 40 } },
        { id: "r_a", shape: "rect", rect: { x: 100, y: 500, w: 60, h: 60 } },
        { id: "t_b", shape: "rect", rect: { x: 200, y: 100, w: 50, h: 50 } },
        { id: "r_b", shape: "rect", rect: { x: 200, y: 500, w: 60, h: 60 } },
      ],
      objectives: [
        {
          id: "a",
          label: "Brass key",
          targetRegionId: "t_a",
          referenceRegionId: "r_a",
        },
        {
          id: "b",
          label: "Leather book",
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

const hogScene = fixtureGame.scenes[0] as HiddenObjectSceneType;

function makeLoaded(): LoadedGame {
  return {
    game: fixtureGame,
    bundleBaseUrl: "./games/hog_fixture/",
    resolveAssetUrl: (path) => `./games/hog_fixture/${path}`,
  };
}

function setupStore(): LoadedGame {
  const loaded = makeLoaded();
  usePlayerStore.setState({
    status: "ready",
    loaded,
    engineState: init(loaded.game),
    error: null,
  });
  return loaded;
}

describe("<HiddenObjectScene />", () => {
  beforeEach(() => {
    setupStore();
  });

  it("renders a button per active objective with its label", () => {
    const loaded = makeLoaded();
    render(<HiddenObjectScene scene={hogScene} loaded={loaded} done={false} />);
    expect(screen.getByRole("button", { name: /brass key/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /leather book/i })).toBeEnabled();
  });

  it("positions target buttons at their region coordinates as percentages", () => {
    const loaded = makeLoaded();
    render(<HiddenObjectScene scene={hogScene} loaded={loaded} done={false} />);
    const btn = screen.getByRole("button", { name: /brass key/i });
    // image is 800x600; rect t_a is x=10 y=10 w=40 h=40
    expect(btn.style.left).toBe("1.25%"); // 10/800
    expect(btn.style.top).toBe("1.6666666666666667%"); // 10/600
    expect(btn.style.width).toBe("5%"); // 40/800
    expect(btn.style.height).toBe("6.666666666666667%"); // 40/600
  });

  it("dispatches a find action and announces the find when clicked", async () => {
    const user = userEvent.setup();
    const loaded = setupStore();
    render(<HiddenObjectScene scene={hogScene} loaded={loaded} done={false} />);
    await user.click(screen.getByRole("button", { name: /brass key/i }));
    const state = usePlayerStore.getState();
    expect(state.engineState?.hiddenObject.hog?.foundObjectiveIds).toEqual([
      "a",
    ]);
  });

  it("removes the target button once its objective is found", async () => {
    const user = userEvent.setup();
    const loaded = setupStore();
    const { rerender } = render(
      <HiddenObjectScene scene={hogScene} loaded={loaded} done={false} />,
    );
    await user.click(screen.getByRole("button", { name: /brass key/i }));
    rerender(
      <HiddenObjectScene scene={hogScene} loaded={loaded} done={false} />,
    );
    expect(screen.queryByRole("button", { name: /brass key/i })).toBeNull();
    expect(screen.getByRole("button", { name: /leather book/i })).toBeEnabled();
  });

  it("marks the paired reference as found via data attribute", async () => {
    const user = userEvent.setup();
    const loaded = setupStore();
    const { rerender, container } = render(
      <HiddenObjectScene scene={hogScene} loaded={loaded} done={false} />,
    );
    await user.click(screen.getByRole("button", { name: /brass key/i }));
    rerender(
      <HiddenObjectScene scene={hogScene} loaded={loaded} done={false} />,
    );
    const ref = container.querySelector('[data-region-id="r_a"]');
    expect(ref).not.toBeNull();
    expect(ref?.getAttribute("data-found")).toBe("true");
    const otherRef = container.querySelector('[data-region-id="r_b"]');
    expect(otherRef?.getAttribute("data-found")).toBe("false");
  });

  it("activates a target via the keyboard (Enter on focused button)", async () => {
    const user = userEvent.setup();
    const loaded = setupStore();
    render(<HiddenObjectScene scene={hogScene} loaded={loaded} done={false} />);
    const btn = screen.getByRole("button", { name: /brass key/i });
    btn.focus();
    await user.keyboard("{Enter}");
    expect(
      usePlayerStore.getState().engineState?.hiddenObject.hog
        ?.foundObjectiveIds,
    ).toEqual(["a"]);
  });

  it("uses an accessible group label that includes the scene title", () => {
    const loaded = makeLoaded();
    render(<HiddenObjectScene scene={hogScene} loaded={loaded} done={false} />);
    expect(screen.getByRole("group", { name: /library/i })).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const loaded = makeLoaded();
    const { container } = render(
      <HiddenObjectScene scene={hogScene} loaded={loaded} done={false} />,
    );
    const results = await axe(container, { preload: false });
    expect(results).toHaveNoViolations();
  });
});
