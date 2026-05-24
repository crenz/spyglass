import { SCHEMA_VERSION, gameSchema, type Game } from "./game";

export class SchemaMigrationError extends Error {
  constructor(
    message: string,
    readonly fromVersion: unknown,
  ) {
    super(message);
    this.name = "SchemaMigrationError";
  }
}

type RawGame = Record<string, unknown>;

const MIGRATIONS: Record<number, (raw: RawGame) => RawGame> = {
  // v1 → v2: additive (cutscene scenes are new but optional). Bump the version.
  1: (raw) => ({ ...raw, version: 2 }),
  // v2 → v3: additive (hidden_object scenes are new but optional). Bump the version.
  2: (raw) => ({ ...raw, version: 3 }),
  // v3 → v4: regions gain `kind` (target/reference/hint/menu/pause) and
  // shape gains `polygon` + `circle`. Existing rect regions are inferred to be
  // `target` or `reference` from the objectives that point at them.
  3: migrateV3ToV4,
};

interface RawRegion {
  id?: unknown;
  kind?: unknown;
  shape?: unknown;
  [key: string]: unknown;
}

interface RawObjective {
  targetRegionId?: unknown;
  referenceRegionId?: unknown;
  [key: string]: unknown;
}

interface RawScene {
  kind?: unknown;
  regions?: unknown;
  objectives?: unknown;
  [key: string]: unknown;
}

function migrateV3ToV4(raw: RawGame): RawGame {
  const scenes = Array.isArray(raw.scenes) ? (raw.scenes as RawScene[]) : [];
  const nextScenes = scenes.map((scene) => {
    if (scene.kind !== "hidden_object") return scene;
    const regions = Array.isArray(scene.regions)
      ? (scene.regions as RawRegion[])
      : [];
    const objectives = Array.isArray(scene.objectives)
      ? (scene.objectives as RawObjective[])
      : [];
    const targetIds = new Set<string>();
    const referenceIds = new Set<string>();
    for (const obj of objectives) {
      if (typeof obj.targetRegionId === "string")
        targetIds.add(obj.targetRegionId);
      if (typeof obj.referenceRegionId === "string")
        referenceIds.add(obj.referenceRegionId);
    }
    const nextRegions = regions.map((region) => {
      if (region.kind !== undefined) return region;
      const id = region.id;
      let inferred: string = "target";
      if (typeof id === "string") {
        if (referenceIds.has(id)) inferred = "reference";
        else if (targetIds.has(id)) inferred = "target";
      }
      return { ...region, kind: inferred };
    });
    return { ...scene, regions: nextRegions };
  });
  return { ...raw, version: 4, scenes: nextScenes };
}

/**
 * Forward-migrates a raw game object to the current SCHEMA_VERSION, then validates it.
 * Each step in the version chain is handled by a small additive migrator.
 */
export function migrate(raw: unknown): Game {
  if (typeof raw !== "object" || raw === null) {
    throw new SchemaMigrationError("Game must be a JSON object.", typeof raw);
  }
  let current = { ...(raw as RawGame) };
  const startVersion = current.version;
  if (startVersion === undefined) {
    throw new SchemaMigrationError(
      'Game is missing a "version" field.',
      startVersion,
    );
  }
  if (typeof startVersion !== "number") {
    throw new SchemaMigrationError(
      `Unknown schema version ${String(startVersion)}. Current is ${SCHEMA_VERSION}.`,
      startVersion,
    );
  }

  while (current.version !== SCHEMA_VERSION) {
    const v = current.version as number;
    const step = MIGRATIONS[v];
    if (!step) {
      throw new SchemaMigrationError(
        `Unknown schema version ${String(v)}. Current is ${SCHEMA_VERSION}.`,
        v,
      );
    }
    current = step(current);
  }

  return gameSchema.parse(current);
}
