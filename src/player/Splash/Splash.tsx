import { useCallback, useEffect, useRef } from "react";
import type { SplashScene } from "@/schema/game";
import type { LoadedGame } from "@/loaders/types";
import { usePlayerStore } from "@/state/playerStore";

interface SplashProps {
  scene: SplashScene;
  loaded: LoadedGame;
  done: boolean;
}

const ADVANCE_HINTS: Record<SplashScene["advance"]["kind"], string> = {
  click: "Click or press Enter to continue",
  key: "Press any key to continue",
  timeout: "Continuing automatically…",
};

const NON_ADVANCING_KEYS = new Set([
  "Tab",
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "CapsLock",
  "NumLock",
  "ScrollLock",
  "Escape",
  "ContextMenu",
]);

export function Splash({ scene, loaded, done }: SplashProps) {
  const dispatch = usePlayerStore((s) => s.dispatch);
  const advance = useCallback(() => dispatch({ type: "advance" }), [dispatch]);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (done) return;
    buttonRef.current?.focus();
  }, [scene.id, done]);

  useEffect(() => {
    if (done) return;
    if (scene.advance.kind !== "key") return;
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (NON_ADVANCING_KEYS.has(event.key)) return;
      event.preventDefault();
      advance();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [scene.id, scene.advance.kind, advance, done]);

  useEffect(() => {
    if (done) return;
    if (scene.advance.kind !== "timeout") return;
    const id = window.setTimeout(advance, scene.advance.timeoutMs);
    return () => window.clearTimeout(id);
  }, [scene.id, scene.advance, advance, done]);

  const clickHandler =
    scene.advance.kind === "timeout" || done ? undefined : advance;
  const label = scene.title
    ? `${scene.title} — ${ADVANCE_HINTS[scene.advance.kind]}`
    : ADVANCE_HINTS[scene.advance.kind];

  return (
    <button
      ref={buttonRef}
      type="button"
      className="splash"
      data-testid="splash"
      data-scene-id={scene.id}
      data-advance={scene.advance.kind}
      data-done={done ? "true" : "false"}
      aria-label={label}
      disabled={done}
      onClick={clickHandler}
    >
      <img
        className="splash-image"
        src={loaded.resolveAssetUrl(scene.image)}
        alt={scene.title ?? "Splash screen"}
        draggable={false}
      />
      {done ? null : (
        <span className="splash-hint">{ADVANCE_HINTS[scene.advance.kind]}</span>
      )}
    </button>
  );
}
