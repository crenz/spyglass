import type { HiddenObjectScene } from "@/schema/game";

export function resolveHiddenObjectComplete(
  scene: HiddenObjectScene,
): string | null {
  return scene.onComplete.gotoSceneId;
}
