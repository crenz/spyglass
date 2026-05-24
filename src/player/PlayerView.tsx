import { useMemo } from "react";
import { usePlayerStore } from "@/state/playerStore";
import { currentScene } from "@/engine/machine";
import { Splash } from "./Splash/Splash";
import { Cutscene } from "./Cutscene/Cutscene";
import { A11yLayer } from "./A11yLayer/A11yLayer";

export function PlayerView() {
  const status = usePlayerStore((s) => s.status);
  const error = usePlayerStore((s) => s.error);
  const loaded = usePlayerStore((s) => s.loaded);
  const engineState = usePlayerStore((s) => s.engineState);

  const scene = useMemo(() => {
    if (!loaded || !engineState) return null;
    return currentScene(loaded.game, engineState);
  }, [loaded, engineState]);

  return (
    <main className="player-view" data-testid="player-view">
      {status === "idle" || status === "loading" ? (
        <p className="player-status" data-status={status}>
          Loading…
        </p>
      ) : null}
      {status === "error" ? (
        <p className="player-status" data-status="error" role="alert">
          Failed to load game: {error ?? "unknown error"}
        </p>
      ) : null}
      {status === "ready" && loaded && scene && engineState ? (
        <>
          {scene.kind === "splash" ? (
            <Splash scene={scene} loaded={loaded} done={engineState.done} />
          ) : null}
          {scene.kind === "cutscene" ? (
            <Cutscene scene={scene} loaded={loaded} done={engineState.done} />
          ) : null}
          <A11yLayer />
        </>
      ) : null}
    </main>
  );
}
