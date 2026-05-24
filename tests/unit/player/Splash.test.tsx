import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Splash } from "@/player/Splash/Splash";
import { usePlayerStore } from "@/state/playerStore";
import { init } from "@/engine/machine";
import { helloGame, makeLoadedGame } from "../_fixtures/game";

function setupStore() {
  const loaded = makeLoadedGame();
  usePlayerStore.setState({
    status: "ready",
    loaded,
    engineState: init(loaded.game),
    error: null,
  });
  return loaded;
}

describe("<Splash />", () => {
  beforeEach(() => {
    setupStore();
  });

  it("renders the image with the scene title as alt text", () => {
    const loaded = makeLoadedGame();
    render(
      <Splash scene={helloGame.scenes[0]!} loaded={loaded} done={false} />,
    );
    const img = screen.getByRole("img", { name: "Title" });
    expect(img).toHaveAttribute("src", "./games/hello/images/title.png");
  });

  it("advances on click in click-mode", async () => {
    const user = userEvent.setup();
    const loaded = setupStore();
    render(
      <Splash scene={helloGame.scenes[0]!} loaded={loaded} done={false} />,
    );
    await user.click(screen.getByRole("button"));
    expect(usePlayerStore.getState().engineState?.currentSceneId).toBe("intro");
  });

  it("advances on Enter in click-mode (button native activation)", async () => {
    const user = userEvent.setup();
    const loaded = setupStore();
    render(
      <Splash scene={helloGame.scenes[0]!} loaded={loaded} done={false} />,
    );
    await user.keyboard("{Enter}");
    expect(usePlayerStore.getState().engineState?.currentSceneId).toBe("intro");
  });

  it("advances on any key in key-mode", async () => {
    const user = userEvent.setup();
    // Walk to the second scene which is key-mode
    const loaded = setupStore();
    act(() => {
      usePlayerStore.getState().dispatch({ type: "advance" });
    });
    render(
      <Splash scene={helloGame.scenes[1]!} loaded={loaded} done={false} />,
    );
    await user.keyboard("x");
    expect(usePlayerStore.getState().engineState?.done).toBe(true);
  });

  it("ignores Tab and modifier keys in key-mode", async () => {
    const user = userEvent.setup();
    const loaded = setupStore();
    act(() => {
      usePlayerStore.getState().dispatch({ type: "advance" });
    });
    const before = usePlayerStore.getState().engineState;
    render(
      <Splash scene={helloGame.scenes[1]!} loaded={loaded} done={false} />,
    );
    await user.keyboard("{Shift}{Control}");
    expect(usePlayerStore.getState().engineState).toBe(before);
  });

  it("advances after timeoutMs in timeout-mode", async () => {
    vi.useFakeTimers();
    try {
      const loaded = makeLoadedGame();
      const timeoutScene = {
        id: "title",
        kind: "splash" as const,
        title: "Title",
        image: "images/title.png",
        advance: { kind: "timeout" as const, timeoutMs: 1000 },
        onAdvance: { gotoSceneId: "intro" },
      };
      render(<Splash scene={timeoutScene} loaded={loaded} done={false} />);
      expect(usePlayerStore.getState().engineState?.currentSceneId).toBe(
        "title",
      );
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(usePlayerStore.getState().engineState?.currentSceneId).toBe(
        "intro",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("has no accessibility violations", async () => {
    const loaded = makeLoadedGame();
    const { container } = render(
      <Splash scene={helloGame.scenes[0]!} loaded={loaded} done={false} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("disables the button and hides the hint when done", () => {
    const loaded = makeLoadedGame();
    render(<Splash scene={helloGame.scenes[1]!} loaded={loaded} done={true} />);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.queryByText(/press any key/i)).not.toBeInTheDocument();
  });
});
