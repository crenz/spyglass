import { useEffect, useState } from "react";
import { usePlayerStore } from "@/state/playerStore";
import { currentScene } from "@/engine/machine";

export function A11yLayer() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    let previousSceneId: string | null = null;
    let previousDone = false;

    const unsubscribe = usePlayerStore.subscribe((state) => {
      if (!state.loaded || !state.engineState) return;
      const sceneId = state.engineState.currentSceneId;
      const scene = currentScene(state.loaded.game, state.engineState);
      const done = state.engineState.done;

      if (done && !previousDone) {
        setMessage(`Game over. Final scene: ${scene.title ?? scene.id}.`);
      } else if (sceneId !== previousSceneId) {
        setMessage(`Now showing: ${scene.title ?? scene.id}.`);
      }
      previousSceneId = sceneId;
      previousDone = done;
    });

    const state = usePlayerStore.getState();
    if (state.loaded && state.engineState) {
      const scene = currentScene(state.loaded.game, state.engineState);
      previousSceneId = state.engineState.currentSceneId;
      previousDone = state.engineState.done;
      setMessage(`Now showing: ${scene.title ?? scene.id}.`);
    }

    return unsubscribe;
  }, []);

  return (
    <div
      className="visually-hidden"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="a11y-live"
    >
      {message}
    </div>
  );
}
