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
});
