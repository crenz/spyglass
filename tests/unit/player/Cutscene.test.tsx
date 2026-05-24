import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Cutscene } from "@/player/Cutscene/Cutscene";
import { usePlayerStore } from "@/state/playerStore";
import { init } from "@/engine/machine";
import {
  cutsceneSceneSchema,
  gameSchema,
  type CutsceneScene,
  type Game,
} from "@/schema/game";
import type { LoadedGame } from "@/loaders/types";

const cutsceneAlways: CutsceneScene = cutsceneSceneSchema.parse({
  id: "intro_video",
  kind: "cutscene",
  title: "Intro",
  video: "videos/intro.mp4",
  captions: "videos/intro.vtt",
  skipPolicy: { kind: "always" },
  onEnd: { gotoSceneId: "outro" },
});

const cutsceneAfterMs: CutsceneScene = cutsceneSceneSchema.parse({
  id: "intro_video",
  kind: "cutscene",
  title: "Intro",
  video: "videos/intro.mp4",
  skipPolicy: { kind: "after-ms", afterMs: 1000 },
  onEnd: { gotoSceneId: "outro" },
});

const cutsceneNoCaptions: CutsceneScene = cutsceneSceneSchema.parse({
  id: "intro_video",
  kind: "cutscene",
  title: "Intro",
  video: "videos/intro.mp4",
  skipPolicy: { kind: "always" },
  onEnd: { gotoSceneId: "outro" },
});

const fixtureGame: Game = gameSchema.parse({
  id: "with_cutscene",
  version: 2,
  title: "With cutscene",
  startScene: "intro_video",
  scenes: [
    cutsceneAlways,
    {
      id: "outro",
      kind: "splash",
      title: "Outro",
      image: "images/outro.png",
      advance: { kind: "click" },
      onAdvance: { gotoSceneId: null },
    },
  ],
});

function makeLoaded(): LoadedGame {
  return {
    game: fixtureGame,
    bundleBaseUrl: "./games/with_cutscene/",
    resolveAssetUrl: (path) => `./games/with_cutscene/${path}`,
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

describe("<Cutscene />", () => {
  beforeEach(() => {
    setupStore();
  });

  it("renders a video element pointing at the resolved asset", () => {
    const loaded = makeLoaded();
    render(<Cutscene scene={cutsceneAlways} loaded={loaded} done={false} />);
    const video = screen.getByTestId("cutscene-video") as HTMLVideoElement;
    expect(video.tagName).toBe("VIDEO");
    expect(video.getAttribute("src")).toBe(
      "./games/with_cutscene/videos/intro.mp4",
    );
  });

  it("renders muted to satisfy the autoplay-without-sound policy", () => {
    const loaded = makeLoaded();
    render(<Cutscene scene={cutsceneAlways} loaded={loaded} done={false} />);
    const video = screen.getByTestId("cutscene-video") as HTMLVideoElement;
    expect(video.muted).toBe(true);
  });

  it("renders a captions track when captions is supplied", () => {
    const loaded = makeLoaded();
    render(<Cutscene scene={cutsceneAlways} loaded={loaded} done={false} />);
    const track = screen.getByTestId("cutscene-captions") as HTMLTrackElement;
    expect(track.tagName).toBe("TRACK");
    expect(track.kind).toBe("captions");
    expect(track.getAttribute("src")).toBe(
      "./games/with_cutscene/videos/intro.vtt",
    );
  });

  it("omits the captions track when captions is not provided", () => {
    const loaded = makeLoaded();
    render(
      <Cutscene scene={cutsceneNoCaptions} loaded={loaded} done={false} />,
    );
    expect(screen.queryByTestId("cutscene-captions")).toBeNull();
  });

  it("renders an accessible Skip button when skipPolicy is 'always'", () => {
    const loaded = makeLoaded();
    render(<Cutscene scene={cutsceneAlways} loaded={loaded} done={false} />);
    const skip = screen.getByRole("button", { name: /skip/i });
    expect(skip).toBeEnabled();
  });

  it("dispatches advance when the Skip button is clicked", async () => {
    const user = userEvent.setup();
    const loaded = setupStore();
    render(<Cutscene scene={cutsceneAlways} loaded={loaded} done={false} />);
    await user.click(screen.getByRole("button", { name: /skip/i }));
    expect(usePlayerStore.getState().engineState?.currentSceneId).toBe("outro");
  });

  it("dispatches advance when the video fires 'ended'", () => {
    const loaded = setupStore();
    render(<Cutscene scene={cutsceneAlways} loaded={loaded} done={false} />);
    const video = screen.getByTestId("cutscene-video") as HTMLVideoElement;
    fireEvent.ended(video);
    expect(usePlayerStore.getState().engineState?.currentSceneId).toBe("outro");
  });

  it("hides the Skip button until afterMs elapses for 'after-ms' policy", () => {
    vi.useFakeTimers();
    try {
      const loaded = makeLoaded();
      render(<Cutscene scene={cutsceneAfterMs} loaded={loaded} done={false} />);
      expect(screen.queryByRole("button", { name: /skip/i })).toBeNull();
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByRole("button", { name: /skip/i })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("removes the Skip button once the scene is done", () => {
    const loaded = makeLoaded();
    render(<Cutscene scene={cutsceneAlways} loaded={loaded} done={true} />);
    expect(screen.queryByRole("button", { name: /skip/i })).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const loaded = makeLoaded();
    const { container } = render(
      <Cutscene scene={cutsceneAlways} loaded={loaded} done={false} />,
    );
    // axe-core tries to preload media assets; in jsdom that hangs.
    const results = await axe(container, { preload: false });
    expect(results).toHaveNoViolations();
  });
});
