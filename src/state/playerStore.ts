import { create } from "zustand";
import {
  dispatch,
  init,
  type EngineAction,
  type EngineState,
} from "@/engine/machine";
import type { LoadedGame } from "@/loaders/types";

export type PlayerStatus = "idle" | "loading" | "ready" | "error";

export interface PlayerStoreState {
  status: PlayerStatus;
  loaded: LoadedGame | null;
  engineState: EngineState | null;
  error: string | null;
  loadGame(loader: () => Promise<LoadedGame>): Promise<void>;
  dispatch(action: EngineAction): void;
  reset(): void;
}

export const usePlayerStore = create<PlayerStoreState>((set, get) => ({
  status: "idle",
  loaded: null,
  engineState: null,
  error: null,
  async loadGame(loader) {
    set({ status: "loading", error: null });
    try {
      const loaded = await loader();
      set({
        status: "ready",
        loaded,
        engineState: init(loaded.game),
        error: null,
      });
    } catch (err) {
      set({
        status: "error",
        loaded: null,
        engineState: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  dispatch(action) {
    const { loaded, engineState } = get();
    if (!loaded || !engineState) return;
    set({ engineState: dispatch(loaded.game, engineState, action) });
  },
  reset() {
    const { loaded } = get();
    if (!loaded) {
      set({ status: "idle", engineState: null, error: null });
      return;
    }
    set({ engineState: init(loaded.game), error: null });
  },
}));
