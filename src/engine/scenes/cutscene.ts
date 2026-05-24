import type { CutsceneScene } from "@/schema/game";

export function resolveCutsceneEnd(scene: CutsceneScene): string | null {
  return scene.onEnd.gotoSceneId;
}
