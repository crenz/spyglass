import {
  gameSchema,
  splashSceneSchema,
  type Game,
  type SplashScene,
} from "@/schema/game";
import type { LoadedGame } from "@/loaders/types";

export const titleScene: SplashScene = splashSceneSchema.parse({
  id: "title",
  kind: "splash",
  title: "Title",
  image: "images/title.png",
  advance: { kind: "click" },
  onAdvance: { gotoSceneId: "intro" },
});

export const introScene: SplashScene = splashSceneSchema.parse({
  id: "intro",
  kind: "splash",
  title: "Intro",
  image: "images/intro.png",
  advance: { kind: "key" },
  onAdvance: { gotoSceneId: null },
});

export const helloGame: Game = gameSchema.parse({
  id: "hello",
  version: 4,
  title: "Hello",
  startScene: "title",
  scenes: [titleScene, introScene],
});

export function makeLoadedGame(game: Game = helloGame): LoadedGame {
  return {
    game,
    bundleBaseUrl: "./games/hello/",
    resolveAssetUrl: (path) => `./games/hello/${path}`,
  };
}
