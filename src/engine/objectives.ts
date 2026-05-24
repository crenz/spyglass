import type { HiddenObjectScene, Objective } from "@/schema/game";

export class ObjectiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObjectiveError";
  }
}

export function findObjectiveByTargetRegion(
  scene: HiddenObjectScene,
  regionId: string,
): Objective | null {
  return scene.objectives.find((o) => o.targetRegionId === regionId) ?? null;
}

export function findObjectiveByReferenceRegion(
  scene: HiddenObjectScene,
  regionId: string,
): Objective | null {
  return scene.objectives.find((o) => o.referenceRegionId === regionId) ?? null;
}

export function isObjectiveFound(
  found: readonly string[],
  objectiveId: string,
): boolean {
  return found.includes(objectiveId);
}

export function isSceneComplete(
  scene: HiddenObjectScene,
  found: readonly string[],
): boolean {
  return scene.objectives.every((o) => found.includes(o.id));
}

export interface ApplyFindResult {
  readonly next: readonly string[];
  readonly changed: boolean;
}

export function applyFind(
  scene: HiddenObjectScene,
  found: readonly string[],
  objectiveId: string,
): ApplyFindResult {
  const known = scene.objectives.some((o) => o.id === objectiveId);
  if (!known) {
    throw new ObjectiveError(
      `Scene "${scene.id}" has no objective "${objectiveId}".`,
    );
  }
  if (found.includes(objectiveId)) {
    return { next: found, changed: false };
  }
  return { next: [...found, objectiveId], changed: true };
}
