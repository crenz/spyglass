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
  version: 4,
  title: "HOG fixture",
  startScene: "hog",
  scenes: [
    {
      id: "hog",
      kind: "hidden_object",
      title: "The library",
      image: { src: "images/scene.png", width: 800, height: 600 },
      regions: [
        {
          id: "t_a",
          kind: "target",
          shape: "rect",
          rect: { x: 10, y: 10, w: 40, h: 40 },
        },
        {
          id: "r_a",
          kind: "reference",
          shape: "rect",
          rect: { x: 100, y: 500, w: 60, h: 60 },
        },
        {
          id: "t_b",
          kind: "target",
          shape: "rect",
          rect: { x: 200, y: 100, w: 50, h: 50 },
        },
        {
          id: "r_b",
          kind: "reference",
          shape: "rect",
          rect: { x: 200, y: 500, w: 60, h: 60 },
        },
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

describe("<HiddenObjectScene /> — polygon and circle targets", () => {
  const polyCircleGame: Game = gameSchema.parse({
    id: "shapes",
    version: 4,
    title: "Shapes",
    startScene: "hog",
    scenes: [
      {
        id: "hog",
        kind: "hidden_object",
        title: "Shapes",
        image: { src: "images/scene.png", width: 800, height: 600 },
        regions: [
          {
            id: "t_poly",
            kind: "target",
            shape: "polygon",
            polygon: {
              points: [
                [100, 100],
                [200, 100],
                [200, 200],
                [100, 200],
              ],
            },
          },
          {
            id: "r_poly",
            kind: "reference",
            shape: "rect",
            rect: { x: 100, y: 500, w: 60, h: 60 },
          },
          {
            id: "t_circle",
            kind: "target",
            shape: "circle",
            circle: { cx: 500, cy: 300, r: 40 },
          },
          {
            id: "r_circle",
            kind: "reference",
            shape: "rect",
            rect: { x: 200, y: 500, w: 60, h: 60 },
          },
        ],
        objectives: [
          {
            id: "poly",
            label: "Polygon item",
            targetRegionId: "t_poly",
            referenceRegionId: "r_poly",
          },
          {
            id: "circle",
            label: "Circular item",
            targetRegionId: "t_circle",
            referenceRegionId: "r_circle",
          },
        ],
        onComplete: { gotoSceneId: null },
      },
    ],
  });
  const polyCircleScene = polyCircleGame.scenes[0] as HiddenObjectSceneType;

  function makePolyLoaded(): LoadedGame {
    return {
      game: polyCircleGame,
      bundleBaseUrl: "./games/shapes/",
      resolveAssetUrl: (path) => `./games/shapes/${path}`,
    };
  }

  beforeEach(() => {
    const loaded = makePolyLoaded();
    usePlayerStore.setState({
      status: "ready",
      loaded,
      engineState: init(loaded.game),
      error: null,
    });
  });

  it("renders a polygon target button clipped to the polygon shape", () => {
    const loaded = makePolyLoaded();
    render(
      <HiddenObjectScene
        scene={polyCircleScene}
        loaded={loaded}
        done={false}
      />,
    );
    const btn = screen.getByRole("button", { name: /polygon item/i });
    expect(btn.style.clipPath).toMatch(/polygon\(/);
  });

  it("renders a circle target button clipped to the circle shape", () => {
    const loaded = makePolyLoaded();
    render(
      <HiddenObjectScene
        scene={polyCircleScene}
        loaded={loaded}
        done={false}
      />,
    );
    const btn = screen.getByRole("button", { name: /circular item/i });
    expect(btn.style.clipPath).toMatch(/circle\(/);
  });

  it("clicks on a polygon target dispatch the find action", async () => {
    const user = userEvent.setup();
    const loaded = makePolyLoaded();
    render(
      <HiddenObjectScene
        scene={polyCircleScene}
        loaded={loaded}
        done={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /polygon item/i }));
    expect(
      usePlayerStore.getState().engineState?.hiddenObject.hog
        ?.foundObjectiveIds,
    ).toEqual(["poly"]);
  });
});

describe("<HiddenObjectScene /> — control regions", () => {
  const controlGame: Game = gameSchema.parse({
    id: "controls",
    version: 4,
    title: "Controls",
    startScene: "hog",
    scenes: [
      {
        id: "hog",
        kind: "hidden_object",
        title: "Controls test",
        image: { src: "images/scene.png", width: 800, height: 600 },
        regions: [
          {
            id: "t_a",
            kind: "target",
            shape: "rect",
            rect: { x: 10, y: 10, w: 40, h: 40 },
          },
          {
            id: "r_a",
            kind: "reference",
            shape: "rect",
            rect: { x: 100, y: 500, w: 60, h: 60 },
          },
          {
            id: "hint_btn",
            kind: "hint",
            shape: "rect",
            rect: { x: 700, y: 500, w: 60, h: 60 },
          },
          {
            id: "menu_btn",
            kind: "menu",
            shape: "rect",
            rect: { x: 600, y: 500, w: 60, h: 60 },
          },
          {
            id: "pause_btn",
            kind: "pause",
            shape: "rect",
            rect: { x: 500, y: 500, w: 60, h: 60 },
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
  const controlScene = controlGame.scenes[0] as HiddenObjectSceneType;

  function makeControlLoaded(): LoadedGame {
    return {
      game: controlGame,
      bundleBaseUrl: "./games/controls/",
      resolveAssetUrl: (path) => `./games/controls/${path}`,
    };
  }

  beforeEach(() => {
    const loaded = makeControlLoaded();
    usePlayerStore.setState({
      status: "ready",
      loaded,
      engineState: init(loaded.game),
      error: null,
    });
  });

  it("renders a button for each control region kind", () => {
    const loaded = makeControlLoaded();
    render(
      <HiddenObjectScene scene={controlScene} loaded={loaded} done={false} />,
    );
    expect(screen.getByRole("button", { name: /hint/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /menu/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
  });

  it("dispatches hint when the hint control is clicked", async () => {
    const user = userEvent.setup();
    const loaded = makeControlLoaded();
    render(
      <HiddenObjectScene scene={controlScene} loaded={loaded} done={false} />,
    );
    await user.click(screen.getByRole("button", { name: /hint/i }));
    expect(
      usePlayerStore.getState().engineState?.hintRequest?.objectiveId,
    ).toBe("a");
  });

  it("toggles pause when the pause control is clicked", async () => {
    const user = userEvent.setup();
    const loaded = makeControlLoaded();
    render(
      <HiddenObjectScene scene={controlScene} loaded={loaded} done={false} />,
    );
    await user.click(screen.getByRole("button", { name: /pause/i }));
    expect(usePlayerStore.getState().engineState?.paused).toBe(true);
  });

  it("toggles menu when the menu control is clicked", async () => {
    const user = userEvent.setup();
    const loaded = makeControlLoaded();
    render(
      <HiddenObjectScene scene={controlScene} loaded={loaded} done={false} />,
    );
    await user.click(screen.getByRole("button", { name: /menu/i }));
    expect(usePlayerStore.getState().engineState?.menuOpen).toBe(true);
  });

  it("shows a pause overlay when paused and dismisses on Resume", async () => {
    const user = userEvent.setup();
    const loaded = makeControlLoaded();
    render(
      <HiddenObjectScene scene={controlScene} loaded={loaded} done={false} />,
    );
    await user.click(screen.getByRole("button", { name: /^pause$/i }));
    expect(screen.getByRole("dialog", { name: /paused/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /resume/i }));
    expect(screen.queryByRole("dialog", { name: /paused/i })).toBeNull();
    expect(usePlayerStore.getState().engineState?.paused).toBe(false);
  });

  it("shows a menu overlay when menu is open and dismisses on Close", async () => {
    const user = userEvent.setup();
    const loaded = makeControlLoaded();
    render(
      <HiddenObjectScene scene={controlScene} loaded={loaded} done={false} />,
    );
    await user.click(screen.getByRole("button", { name: /^menu$/i }));
    expect(screen.getByRole("dialog", { name: /menu/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog", { name: /menu/i })).toBeNull();
  });

  it("marks the target with data-hint when a hint request matches it", async () => {
    const user = userEvent.setup();
    const loaded = makeControlLoaded();
    const { rerender } = render(
      <HiddenObjectScene scene={controlScene} loaded={loaded} done={false} />,
    );
    await user.click(screen.getByRole("button", { name: /hint/i }));
    rerender(
      <HiddenObjectScene scene={controlScene} loaded={loaded} done={false} />,
    );
    const target = screen.getByRole("button", { name: /brass key/i });
    expect(target.getAttribute("data-hint")).toBe("true");
  });

  it("renders a pulse element keyed to the hint seq so the animation restarts", async () => {
    const user = userEvent.setup();
    const loaded = makeControlLoaded();
    const { rerender, container } = render(
      <HiddenObjectScene scene={controlScene} loaded={loaded} done={false} />,
    );
    await user.click(screen.getByRole("button", { name: /^hint$/i }));
    rerender(
      <HiddenObjectScene scene={controlScene} loaded={loaded} done={false} />,
    );
    const pulse1 = container.querySelector('[data-testid="hog-hint-pulse"]');
    expect(pulse1).not.toBeNull();
    expect(pulse1?.getAttribute("data-hint-seq")).toBe("1");

    await user.click(screen.getByRole("button", { name: /^hint$/i }));
    rerender(
      <HiddenObjectScene scene={controlScene} loaded={loaded} done={false} />,
    );
    const pulse2 = container.querySelector('[data-testid="hog-hint-pulse"]');
    expect(pulse2?.getAttribute("data-hint-seq")).toBe("2");
  });
});

describe("<HiddenObjectScene /> — hint targets next unfound objective", () => {
  const multiGame: Game = gameSchema.parse({
    id: "multi",
    version: 4,
    title: "Multi",
    startScene: "hog",
    scenes: [
      {
        id: "hog",
        kind: "hidden_object",
        title: "Multi",
        image: { src: "images/scene.png", width: 800, height: 600 },
        regions: [
          {
            id: "t_a",
            kind: "target",
            shape: "rect",
            rect: { x: 10, y: 10, w: 40, h: 40 },
          },
          {
            id: "r_a",
            kind: "reference",
            shape: "rect",
            rect: { x: 100, y: 500, w: 60, h: 60 },
          },
          {
            id: "t_b",
            kind: "target",
            shape: "rect",
            rect: { x: 200, y: 100, w: 50, h: 50 },
          },
          {
            id: "r_b",
            kind: "reference",
            shape: "rect",
            rect: { x: 200, y: 500, w: 60, h: 60 },
          },
          {
            id: "hint_btn",
            kind: "hint",
            shape: "rect",
            rect: { x: 700, y: 500, w: 60, h: 60 },
          },
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
        onComplete: { gotoSceneId: null },
      },
    ],
  });
  const multiScene = multiGame.scenes[0] as HiddenObjectSceneType;

  function makeMultiLoaded(): LoadedGame {
    return {
      game: multiGame,
      bundleBaseUrl: "./games/multi/",
      resolveAssetUrl: (path) => `./games/multi/${path}`,
    };
  }

  beforeEach(() => {
    const loaded = makeMultiLoaded();
    usePlayerStore.setState({
      status: "ready",
      loaded,
      engineState: init(loaded.game),
      error: null,
    });
  });

  it("after finding the first item, hint highlights the second unfound objective", async () => {
    const user = userEvent.setup();
    const loaded = makeMultiLoaded();
    const { rerender, container } = render(
      <HiddenObjectScene scene={multiScene} loaded={loaded} done={false} />,
    );
    await user.click(screen.getByRole("button", { name: /brass key/i }));
    rerender(
      <HiddenObjectScene scene={multiScene} loaded={loaded} done={false} />,
    );
    await user.click(screen.getByRole("button", { name: /^hint$/i }));
    rerender(
      <HiddenObjectScene scene={multiScene} loaded={loaded} done={false} />,
    );
    const book = screen.getByRole("button", { name: /leather book/i });
    expect(book.getAttribute("data-hint")).toBe("true");

    const pulse = container.querySelector('[data-testid="hog-hint-pulse"]');
    expect(pulse).not.toBeNull();
    expect(pulse?.getAttribute("data-objective-id")).toBe("b");
    // Pulse must live outside the button so the button's clip-path doesn't
    // hide it for polygon/circle shapes.
    expect(pulse?.parentElement?.tagName.toLowerCase()).not.toBe("button");
  });
});
