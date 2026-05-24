import { migrate } from "@/schema/migrate";
import { fetchSafe } from "./fetchSafe";
import { GameLoadError, type LoadedGame } from "./types";

const BUNDLED_GAMES_ROOT = "games";

export interface BundledLoaderOptions {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export async function loadBundledGame(
  gameId: string,
  opts: BundledLoaderOptions = {},
): Promise<LoadedGame> {
  const fetchImpl = opts.fetchImpl ?? fetchSafe;
  const baseUrl = normalizeBase(opts.baseUrl);
  const bundleBaseUrl = `${baseUrl}${BUNDLED_GAMES_ROOT}/${gameId}/`;
  const manifestUrl = `${bundleBaseUrl}manifest.json`;

  let response: Response;
  try {
    response = await fetchImpl(manifestUrl);
  } catch (err) {
    throw new GameLoadError(
      `Network error fetching bundled game "${gameId}".`,
      err,
    );
  }
  if (!response.ok) {
    throw new GameLoadError(
      `Failed to fetch bundled game "${gameId}" (HTTP ${response.status}).`,
    );
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (err) {
    throw new GameLoadError(
      `Bundled game "${gameId}" manifest is not valid JSON.`,
      err,
    );
  }

  let game;
  try {
    game = migrate(raw);
  } catch (err) {
    throw new GameLoadError(
      `Bundled game "${gameId}" failed validation: ${describe(err)}`,
      err,
    );
  }

  return Object.freeze({
    game,
    bundleBaseUrl,
    resolveAssetUrl(path: string): string {
      if (
        !path ||
        path.startsWith("/") ||
        path.includes("://") ||
        path.includes("..")
      ) {
        throw new GameLoadError(`Refusing to resolve asset path "${path}".`);
      }
      return `${bundleBaseUrl}${path}`;
    },
  });
}

function normalizeBase(base: string | undefined): string {
  if (!base) return "./";
  return base.endsWith("/") ? base : `${base}/`;
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
