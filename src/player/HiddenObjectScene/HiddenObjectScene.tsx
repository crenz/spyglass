import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type {
  HiddenObjectScene as HiddenObjectSceneType,
  Region,
  RegionKind,
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

interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function regionBoundingBox(region: Region): BoundingBox {
  switch (region.shape) {
    case "rect":
      return region.rect;
    case "circle": {
      const { cx, cy, r } = region.circle;
      return { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
    }
    case "polygon": {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const [px, py] of region.polygon.points) {
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
  }
}

function regionClipPath(region: Region, bb: BoundingBox): string | undefined {
  if (region.shape === "rect") return undefined;
  if (region.shape === "circle") {
    return "circle(50% at 50% 50%)";
  }
  const points = region.polygon.points
    .map(([px, py]) => {
      const lx = bb.w > 0 ? ((px - bb.x) / bb.w) * 100 : 0;
      const ly = bb.h > 0 ? ((py - bb.y) / bb.h) * 100 : 0;
      return `${lx}% ${ly}%`;
    })
    .join(", ");
  return `polygon(${points})`;
}

function regionStyle(
  region: Region,
  imageW: number,
  imageH: number,
): CSSProperties {
  const bb = regionBoundingBox(region);
  const clipPath = regionClipPath(region, bb);
  const style: CSSProperties = {
    left: `${(bb.x / imageW) * 100}%`,
    top: `${(bb.y / imageH) * 100}%`,
    width: `${(bb.w / imageW) * 100}%`,
    height: `${(bb.h / imageH) * 100}%`,
  };
  if (clipPath) style.clipPath = clipPath;
  return style;
}

const CONTROL_LABELS: Record<
  Exclude<RegionKind, "target" | "reference">,
  string
> = {
  hint: "Hint",
  menu: "Menu",
  pause: "Pause",
};

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
  const paused = usePlayerStore((s) => s.engineState?.paused ?? false);
  const menuOpen = usePlayerStore((s) => s.engineState?.menuOpen ?? false);
  const hintRequest = usePlayerStore((s) => s.engineState?.hintRequest ?? null);
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

  const controlRegions = useMemo(
    () =>
      scene.regions.filter(
        (r) => r.kind === "hint" || r.kind === "menu" || r.kind === "pause",
      ),
    [scene.regions],
  );

  const activeHintObjectiveId =
    hintRequest && hintRequest.sceneId === scene.id
      ? hintRequest.objectiveId
      : null;

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

  const handleControl = useCallback(
    (kind: RegionKind) => {
      if (done) return;
      if (kind === "hint") dispatch({ type: "hint" });
      else if (kind === "menu") dispatch({ type: "menu" });
      else if (kind === "pause") dispatch({ type: "pause" });
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
            const isHinted = activeHintObjectiveId === objective.id;
            return (
              <button
                key={objective.id}
                ref={index === 0 ? firstButtonRef : undefined}
                type="button"
                className="hog-target"
                data-testid="hog-target"
                data-objective-id={objective.id}
                data-hint={isHinted ? "true" : "false"}
                aria-label={objective.label}
                style={regionStyle(target, imageW, imageH)}
                onClick={() => handleFind(objective)}
                disabled={done}
              />
            );
          })}
          {activeObjectives.map((objective) => {
            if (activeHintObjectiveId !== objective.id) return null;
            const target = scene.regions.find(
              (r) => r.id === objective.targetRegionId,
            );
            if (!target) return null;
            const hintSeq = hintRequest?.seq ?? 0;
            return (
              <div
                key={`pulse-${objective.id}-${hintSeq}`}
                aria-hidden="true"
                data-testid="hog-hint-pulse"
                data-objective-id={objective.id}
                data-hint-seq={hintSeq}
                className="hog-hint-pulse"
                style={regionStyle(target, imageW, imageH)}
              />
            );
          })}
          {controlRegions.map((region) => {
            if (
              region.kind !== "hint" &&
              region.kind !== "menu" &&
              region.kind !== "pause"
            ) {
              return null;
            }
            const label = CONTROL_LABELS[region.kind];
            return (
              <button
                key={`ctrl-${region.id}`}
                type="button"
                className="hog-control"
                data-testid="hog-control"
                data-region-id={region.id}
                data-control-kind={region.kind}
                aria-label={label}
                style={regionStyle(region, imageW, imageH)}
                onClick={() => handleControl(region.kind)}
                disabled={done}
              />
            );
          })}
        </div>
      </div>
      {paused ? (
        <div
          role="dialog"
          aria-label="Paused"
          aria-modal="true"
          className="hog-overlay"
          data-testid="hog-pause-overlay"
        >
          <div className="hog-overlay-card">
            <h2>Paused</h2>
            <button
              type="button"
              onClick={() => dispatch({ type: "pause", paused: false })}
            >
              Resume
            </button>
          </div>
        </div>
      ) : null}
      {menuOpen ? (
        <div
          role="dialog"
          aria-label="Menu"
          aria-modal="true"
          className="hog-overlay"
          data-testid="hog-menu-overlay"
        >
          <div className="hog-overlay-card">
            <h2>Menu</h2>
            <button
              type="button"
              onClick={() => dispatch({ type: "menu", open: false })}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const EMPTY: readonly string[] = Object.freeze([]);
