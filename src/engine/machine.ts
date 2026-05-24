import type { Game, Scene } from "@/schema/game";
import { resolveSplashAdvance } from "./scenes/splash";
import { resolveCutsceneEnd } from "./scenes/cutscene";

export interface EngineState {
  readonly currentSceneId: string;
  readonly history: readonly string[];
  readonly done: boolean;
}

export type EngineAction =
  | { type: "advance" }
  | { type: "goto"; sceneId: string | null };

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineError";
  }
}

export function init(game: Game): EngineState {
  const scene = findScene(game, game.startScene);
  if (!scene) {
    throw new EngineError(
      `startScene "${game.startScene}" not found in game "${game.id}".`,
    );
  }
  return {
    currentSceneId: scene.id,
    history: [],
    done: false,
  };
}

export function dispatch(
  game: Game,
  state: EngineState,
  action: EngineAction,
): EngineState {
  if (state.done) {
    return state;
  }
  switch (action.type) {
    case "advance":
      return advance(game, state);
    case "goto":
      return goto(game, state, action.sceneId);
  }
}

export function currentScene(game: Game, state: EngineState): Scene {
  const scene = findScene(game, state.currentSceneId);
  if (!scene) {
    throw new EngineError(
      `current scene "${state.currentSceneId}" is not in game "${game.id}".`,
    );
  }
  return scene;
}

function advance(game: Game, state: EngineState): EngineState {
  const scene = currentScene(game, state);
  let nextSceneId: string | null;
  switch (scene.kind) {
    case "splash":
      nextSceneId = resolveSplashAdvance(scene);
      break;
    case "cutscene":
      nextSceneId = resolveCutsceneEnd(scene);
      break;
  }
  return goto(game, state, nextSceneId);
}

function goto(
  game: Game,
  state: EngineState,
  sceneId: string | null,
): EngineState {
  if (sceneId === null) {
    return {
      currentSceneId: state.currentSceneId,
      history: [...state.history, state.currentSceneId],
      done: true,
    };
  }
  const next = findScene(game, sceneId);
  if (!next) {
    throw new EngineError(
      `cannot goto "${sceneId}": no such scene in game "${game.id}".`,
    );
  }
  return {
    currentSceneId: next.id,
    history: [...state.history, state.currentSceneId],
    done: false,
  };
}

function findScene(game: Game, id: string): Scene | undefined {
  return game.scenes.find((s) => s.id === id);
}
