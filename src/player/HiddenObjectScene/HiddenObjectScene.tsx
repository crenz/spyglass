import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type {
  HiddenObjectScene as HiddenObjectSceneType,
  Region,
  Objective,
} from "@/schema/game";
import type { LoadedGame } from "@/loaders/types";
import { usePlayerStore } from "@/state/playerStore";
import {
  findObjectiveByReferenceRegion,
  isObjectiveFound,
} from "@/engine/objectives";

interface HiddenObjectSceneProps {
  scene: HiddenObjectSceneType;
  loaded: LoadedGame;
  done: boolean;
}

function regionStyle(
  region: Region,
  imageW: number,
  imageH: number,
): CSSProperties {
  return {
    left: `${(region.rect.x / imageW) * 100}%`,
    top: `${(region.rect.y / imageH) * 100}%`,
    width: `${(region.rect.w / imageW) * 100}%`,
    height: `${(region.rect.h / imageH) * 100}%`,
  };
}

// Aspect-fit a logical image (imageW × imageH) inside a container, returning the
// pixel dimensions of the displayed image. Both buttons and the Konva canvas
// fill this size so percent-based positions land on the same pixels.
function fitDisplay(
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number,
): { width: number; height: number } {
  if (containerW <= 0 || containerH <= 0) return { width: 0, height: 0 };
  const containerAspect = containerW / containerH;
  const imageAspect = imageW / imageH;
  if (containerAspect > imageAspect) {
    const height = containerH;
    return { width: height * imageAspect, height };
  }
  const width = containerW;
  return { width, height: width / imageAspect };
}

export function HiddenObjectScene({
  scene,
  loaded,
  done,
}: HiddenObjectSceneProps) {
  const dispatch = usePlayerStore((s) => s.dispatch);
  const found = usePlayerStore(
    (s) => s.engineState?.hiddenObject[scene.id]?.foundObjectiveIds ?? EMPTY,
  );
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const imageW = scene.image.width;
  const imageH = scene.image.height;

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const measure = () => {
      setDisplay(fitDisplay(el.clientWidth, el.clientHeight, imageW, imageH));
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [imageW, imageH]);

  const activeObjectives = useMemo(
    () => scene.objectives.filter((o) => !isObjectiveFound(found, o.id)),
    [scene.objectives, found],
  );

  useEffect(() => {
    if (done) return;
    firstButtonRef.current?.focus();
  }, [scene.id, done, activeObjectives.length]);

  const handleFind = useCallback(
    (objective: Objective) => {
      if (done) return;
      dispatch({ type: "find", objectiveId: objective.id });
    },
    [dispatch, done],
  );

  const imageUrl = loaded.resolveAssetUrl(scene.image.src);

  const sceneStyle: CSSProperties =
    display.width > 0 && display.height > 0
      ? { width: `${display.width}px`, height: `${display.height}px` }
      : { width: "100%", height: "100%" };

  const groupLabel = scene.title ?? "Hidden object scene";

  return (
    <div ref={wrapperRef} className="hog-wrapper" data-testid="hog-wrapper">
      <div
        className="hog-scene"
        data-testid="hog-scene"
        data-scene-id={scene.id}
        data-done={done ? "true" : "false"}
        style={sceneStyle}
      >
        <img
          className="hog-bg"
          data-testid="hog-bg"
          src={imageUrl}
          alt={scene.title ?? "Hidden object scene"}
          width={imageW}
          height={imageH}
          draggable={false}
        />
        <div
          role="group"
          aria-label={groupLabel}
          className="hog-a11y"
          data-testid="hog-a11y"
        >
          {scene.regions.map((region) => {
            const refObjective = findObjectiveByReferenceRegion(
              scene,
              region.id,
            );
            if (refObjective === null) return null;
            const isFound = isObjectiveFound(found, refObjective.id);
            return (
              <div
                key={`ref-${region.id}`}
                className="hog-reference"
                data-region-id={region.id}
                data-objective-id={refObjective.id}
                data-found={isFound ? "true" : "false"}
                aria-hidden="true"
                style={regionStyle(region, imageW, imageH)}
              />
            );
          })}
          {activeObjectives.map((objective, index) => {
            const target = scene.regions.find(
              (r) => r.id === objective.targetRegionId,
            );
            if (!target) return null;
            return (
              <button
                key={objective.id}
                ref={index === 0 ? firstButtonRef : undefined}
                type="button"
                className="hog-target"
                data-testid="hog-target"
                data-objective-id={objective.id}
                aria-label={objective.label}
                style={regionStyle(target, imageW, imageH)}
                onClick={() => handleFind(objective)}
                disabled={done}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

const EMPTY: readonly string[] = Object.freeze([]);
