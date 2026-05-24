import type { SplashScene } from "@/schema/game";

export function resolveSplashAdvance(scene: SplashScene): string | null {
  return scene.onAdvance.gotoSceneId;
}
