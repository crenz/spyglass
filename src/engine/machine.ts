import type { Game, Scene } from "@/schema/game";
import { resolveSplashAdvance } from "./scenes/splash";
import { resolveCutsceneEnd } from "./scenes/cutscene";
import { resolveHiddenObjectComplete } from "./scenes/hidden_object";
import { applyFind, isSceneComplete } from "./objectives";

export interface HiddenObjectState {
  readonly foundObjectiveIds: readonly string[];
}

export interface EngineState {
  readonly currentSceneId: string;
  readonly history: readonly string[];
  readonly done: boolean;
  readonly hiddenObject: Readonly<Record<string, HiddenObjectState>>;
}

export type EngineAction =
  | { type: "advance" }
  | { type: "goto"; sceneId: string | null }
  | { type: "find"; objectiveId: string };

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
    hiddenObject: {},
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
    case "find":
      return find(game, state, action.objectiveId);
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
    case "hidden_object":
      nextSceneId = resolveHiddenObjectComplete(scene);
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
      ...state,
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
    ...state,
    currentSceneId: next.id,
    history: [...state.history, state.currentSceneId],
    done: false,
  };
}

function find(
  game: Game,
  state: EngineState,
  objectiveId: string,
): EngineState {
  const scene = currentScene(game, state);
  if (scene.kind !== "hidden_object") {
    throw new EngineError(
      `cannot dispatch "find" in scene "${scene.id}" (kind: ${scene.kind}).`,
    );
  }
  const current =
    state.hiddenObject[scene.id]?.foundObjectiveIds ?? Object.freeze([]);
  const { next, changed } = applyFind(scene, current, objectiveId);
  if (!changed) {
    return state;
  }
  const updated: EngineState = {
    ...state,
    hiddenObject: {
      ...state.hiddenObject,
      [scene.id]: { foundObjectiveIds: next },
    },
  };
  if (isSceneComplete(scene, next)) {
    return goto(game, updated, resolveHiddenObjectComplete(scene));
  }
  return updated;
}

function findScene(game: Game, id: string): Scene | undefined {
  return game.scenes.find((s) => s.id === id);
}
