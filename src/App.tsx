import { useEffect } from "react";
import { PlayerView } from "./player/PlayerView";
import { loadBundledGame } from "./loaders/bundled";
import { usePlayerStore } from "./state/playerStore";

const DEFAULT_GAME_ID = "hello";

export default function App() {
  const status = usePlayerStore((s) => s.status);
  const loadGame = usePlayerStore((s) => s.loadGame);

  useEffect(() => {
    if (status === "idle") {
      void loadGame(() => loadBundledGame(DEFAULT_GAME_ID));
    }
  }, [status, loadGame]);

  return <PlayerView />;
}
