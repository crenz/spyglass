import { describe, it, expect } from "vitest";
import { gameSchema, splashSceneSchema, SCHEMA_VERSION } from "@/schema/game";
import { migrate, SchemaMigrationError } from "@/schema/migrate";

const validGame = {
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
};

describe("gameSchema", () => {
  it("round-trips a valid splash-only game", () => {
    const parsed = gameSchema.parse(validGame);
    expect(parsed.id).toBe("hello");
    expect(parsed.scenes).toHaveLength(2);
    expect(parsed.scenes[0]?.kind).toBe("splash");
  });

  it("accepts a timeout-based splash", () => {
    const game = structuredClone(validGame);
    game.scenes[0]!.advance = {
      kind: "timeout",
      timeoutMs: 3000,
    } as (typeof game.scenes)[0]["advance"];
    expect(() => gameSchema.parse(game)).not.toThrow();
  });

  it("rejects a wrong version", () => {
    const game = { ...validGame, version: 2 };
    expect(() => gameSchema.parse(game)).toThrow();
  });

  it("rejects duplicate scene IDs", () => {
    const game = structuredClone(validGame);
    game.scenes[1]!.id = "title";
    const err = gameSchema.safeParse(game);
    expect(err.success).toBe(false);
    if (!err.success) {
      expect(
        err.error.issues.some((i) => i.message.includes("Duplicate")),
      ).toBe(true);
    }
  });

  it("rejects a startScene that does not match any scene", () => {
    const game = { ...validGame, startScene: "nope" };
    const err = gameSchema.safeParse(game);
    expect(err.success).toBe(false);
    if (!err.success) {
      expect(
        err.error.issues.some((i) => i.message.includes("startScene")),
      ).toBe(true);
    }
  });

  it("rejects a goto to an unknown scene", () => {
    const game = structuredClone(validGame);
    game.scenes[0]!.onAdvance.gotoSceneId = "ghost";
    const err = gameSchema.safeParse(game);
    expect(err.success).toBe(false);
    if (!err.success) {
      expect(
        err.error.issues.some((i) => i.message.includes("unknown scene")),
      ).toBe(true);
    }
  });

  it("rejects an asset path with a leading slash", () => {
    const parsed = splashSceneSchema.safeParse({
      id: "x",
      kind: "splash",
      image: "/leak.png",
      advance: { kind: "click" },
      onAdvance: { gotoSceneId: null },
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an asset path containing ".."', () => {
    const parsed = splashSceneSchema.safeParse({
      id: "x",
      kind: "splash",
      image: "../escape.png",
      advance: { kind: "click" },
      onAdvance: { gotoSceneId: null },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects scene IDs with uppercase letters", () => {
    const parsed = splashSceneSchema.safeParse({
      id: "Title",
      kind: "splash",
      image: "images/title.png",
      advance: { kind: "click" },
      onAdvance: { gotoSceneId: null },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a timeout advance with a non-positive timeoutMs", () => {
    const game = structuredClone(validGame);
    game.scenes[0]!.advance = {
      kind: "timeout",
      timeoutMs: 0,
    } as (typeof game.scenes)[0]["advance"];
    expect(() => gameSchema.parse(game)).toThrow();
  });

  it("exports the current schema version", () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});

describe("migrate", () => {
  it("passes through a current-version game", () => {
    const parsed = migrate(validGame);
    expect(parsed.id).toBe("hello");
  });

  it("throws SchemaMigrationError for a missing version", () => {
    const { version: _omit, ...rest } = validGame;
    expect(() => migrate(rest)).toThrow(SchemaMigrationError);
  });

  it("throws SchemaMigrationError for an unknown version", () => {
    expect(() => migrate({ ...validGame, version: 99 })).toThrow(
      SchemaMigrationError,
    );
  });

  it("throws SchemaMigrationError for a non-object input", () => {
    expect(() => migrate(null)).toThrow(SchemaMigrationError);
    expect(() => migrate("string")).toThrow(SchemaMigrationError);
  });
});
