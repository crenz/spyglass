import { useEffect, useState } from "react";
import { usePlayerStore } from "@/state/playerStore";
import { currentScene } from "@/engine/machine";

export function A11yLayer() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    let previousSceneId: string | null = null;
    let previousDone = false;
    let previousFound: readonly string[] = [];

    const unsubscribe = usePlayerStore.subscribe((state) => {
      if (!state.loaded || !state.engineState) return;
      const sceneId = state.engineState.currentSceneId;
      const scene = currentScene(state.loaded.game, state.engineState);
      const done = state.engineState.done;
      const sceneChanged = sceneId !== previousSceneId;

      if (done && !previousDone) {
        setMessage(`Game over. Final scene: ${scene.title ?? scene.id}.`);
      } else if (sceneChanged) {
        setMessage(`Now showing: ${scene.title ?? scene.id}.`);
      } else if (scene.kind === "hidden_object") {
        const found =
          state.engineState.hiddenObject[scene.id]?.foundObjectiveIds ?? [];
        if (found.length > previousFound.length) {
          const newId = found[found.length - 1];
          const objective = scene.objectives.find((o) => o.id === newId);
          if (objective) {
            setMessage(`Found: ${objective.label}.`);
          }
        }
        previousFound = found;
      }
      if (sceneChanged) {
        const scene = currentScene(state.loaded.game, state.engineState);
        previousFound =
          scene.kind === "hidden_object"
            ? (state.engineState.hiddenObject[scene.id]?.foundObjectiveIds ??
              [])
            : [];
      }
      previousSceneId = sceneId;
      previousDone = done;
    });

    const state = usePlayerStore.getState();
    if (state.loaded && state.engineState) {
      const scene = currentScene(state.loaded.game, state.engineState);
      previousSceneId = state.engineState.currentSceneId;
      previousDone = state.engineState.done;
      previousFound =
        scene.kind === "hidden_object"
          ? (state.engineState.hiddenObject[scene.id]?.foundObjectiveIds ?? [])
          : [];
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
