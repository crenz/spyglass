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
};

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
