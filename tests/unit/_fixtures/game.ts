import { gameSchema, type Game } from "@/schema/game";
import type { LoadedGame } from "@/loaders/types";

export const helloGame: Game = gameSchema.parse({
  id: "hello",
  version: 1,
  title: "Hello",
  startScene: "title",
  scenes: [
    {
      id: "title",
      kind: "splash",
      title: "Title",
      image: "images/title.png",
      advance: { kind: "click" },
      onAdvance: { gotoSceneId: "intro" },
    },
    {
      id: "intro",
      kind: "splash",
      title: "Intro",
      image: "images/intro.png",
      advance: { kind: "key" },
      onAdvance: { gotoSceneId: null },
    },
  ],
});

export function makeLoadedGame(game: Game = helloGame): LoadedGame {
  return {
    game,
    bundleBaseUrl: "./games/hello/",
    resolveAssetUrl: (path) => `./games/hello/${path}`,
  };
}
