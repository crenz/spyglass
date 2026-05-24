import { useCallback, useEffect, useRef, useState } from "react";
import type { CutsceneScene } from "@/schema/game";
import type { LoadedGame } from "@/loaders/types";
import { usePlayerStore } from "@/state/playerStore";

interface CutsceneProps {
  scene: CutsceneScene;
  loaded: LoadedGame;
  done: boolean;
}

export function Cutscene({ scene, loaded, done }: CutsceneProps) {
  const dispatch = usePlayerStore((s) => s.dispatch);
  const advance = useCallback(() => dispatch({ type: "advance" }), [dispatch]);
  const skipRef = useRef<HTMLButtonElement>(null);

  const initiallySkippable = scene.skipPolicy.kind === "always";
  const [skipReady, setSkipReady] = useState(initiallySkippable);

  useEffect(() => {
    if (scene.skipPolicy.kind === "always") {
      setSkipReady(true);
      return;
    }
    setSkipReady(false);
    const id = window.setTimeout(
      () => setSkipReady(true),
      scene.skipPolicy.afterMs,
    );
    return () => window.clearTimeout(id);
  }, [scene.id, scene.skipPolicy]);

  useEffect(() => {
    if (done || !skipReady) return;
    skipRef.current?.focus();
  }, [scene.id, done, skipReady]);

  const handleEnded = useCallback(() => {
    if (done) return;
    advance();
  }, [advance, done]);

  const showSkip = !done && skipReady;
  const captionsSrc = scene.captions
    ? loaded.resolveAssetUrl(scene.captions)
    : null;

  return (
    <div
      className="cutscene"
      data-testid="cutscene"
      data-scene-id={scene.id}
      data-done={done ? "true" : "false"}
    >
      <video
        className="cutscene-video"
        data-testid="cutscene-video"
        src={loaded.resolveAssetUrl(scene.video)}
        muted
        autoPlay
        playsInline
        controls={false}
        onEnded={handleEnded}
        aria-label={scene.title ?? "Cutscene"}
      >
        {captionsSrc ? (
          <track
            data-testid="cutscene-captions"
            kind="captions"
            src={captionsSrc}
            default
          />
        ) : null}
      </video>
      {showSkip ? (
        <button
          ref={skipRef}
          type="button"
          className="cutscene-skip"
          onClick={advance}
        >
          Skip
        </button>
      ) : null}
    </div>
  );
}
