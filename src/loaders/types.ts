import type { Game } from "@/schema/game";

export interface LoadedGame {
  readonly game: Game;
  readonly bundleBaseUrl: string;
  resolveAssetUrl(path: string): string;
}

export class GameLoadError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GameLoadError";
  }
}
