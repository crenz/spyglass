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

/**
 * Forward-migrates a raw game object to the current SCHEMA_VERSION, then validates it.
 * v1 is the initial version — there are no migrations yet, only a passthrough.
 */
export function migrate(raw: unknown): Game {
  if (typeof raw !== "object" || raw === null) {
    throw new SchemaMigrationError("Game must be a JSON object.", typeof raw);
  }
  const version = (raw as { version?: unknown }).version;
  if (version === undefined) {
    throw new SchemaMigrationError(
      'Game is missing a "version" field.',
      version,
    );
  }
  if (version !== SCHEMA_VERSION) {
    throw new SchemaMigrationError(
      `Unknown schema version ${String(version)}. Current is ${SCHEMA_VERSION}.`,
      version,
    );
  }
  return gameSchema.parse(raw);
}
