import { describe, it, expect } from "vitest";
import {
  gameSchema,
  splashSceneSchema,
  cutsceneSceneSchema,
  SCHEMA_VERSION,
} from "@/schema/game";
import { migrate, SchemaMigrationError } from "@/schema/migrate";

const validGame = {
  id: "hello",
  version: 2,
  title: "Hello",
  startScene: "title",
  scenes: [
    {
      id: "title",
      kind: "splash",
      title: "Title",
      image: "images/title.png",
      advance: { kind: "click" },
      onAdvance: { gotoSceneId: "intro_video" },
    },
    {
      id: "intro_video",
      kind: "cutscene",
      title: "Intro",
      video: "videos/intro.mp4",
      captions: "videos/intro.vtt",
      skipPolicy: { kind: "always" },
      onEnd: { gotoSceneId: "intro" },
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
  it("round-trips a valid splash + cutscene game", () => {
    const parsed = gameSchema.parse(validGame);
    expect(parsed.id).toBe("hello");
    expect(parsed.scenes).toHaveLength(3);
    expect(parsed.scenes[1]?.kind).toBe("cutscene");
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
    const game = { ...validGame, version: 3 };
    expect(() => gameSchema.parse(game)).toThrow();
  });

  it("rejects duplicate scene IDs", () => {
    const game = structuredClone(validGame);
    game.scenes[2]!.id = "title";
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

  it("rejects a splash goto to an unknown scene", () => {
    const game = structuredClone(validGame);
    const splash = game.scenes[0] as {
      onAdvance: { gotoSceneId: string | null };
    };
    splash.onAdvance.gotoSceneId = "ghost";
    const err = gameSchema.safeParse(game);
    expect(err.success).toBe(false);
    if (!err.success) {
      expect(
        err.error.issues.some((i) => i.message.includes("unknown scene")),
      ).toBe(true);
    }
  });

  it("rejects a cutscene onEnd to an unknown scene", () => {
    const game = structuredClone(validGame);
    const cutscene = game.scenes[1] as {
      onEnd: { gotoSceneId: string | null };
    };
    cutscene.onEnd.gotoSceneId = "ghost";
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
    expect(SCHEMA_VERSION).toBe(2);
  });
});

describe("cutsceneSceneSchema", () => {
  const validCutscene = {
    id: "intro_video",
    kind: "cutscene",
    video: "videos/intro.mp4",
    skipPolicy: { kind: "always" },
    onEnd: { gotoSceneId: null },
  };

  it("accepts a minimal cutscene without captions", () => {
    const parsed = cutsceneSceneSchema.parse(validCutscene);
    expect(parsed.video).toBe("videos/intro.mp4");
    expect(parsed.captions).toBeUndefined();
  });

  it("accepts a cutscene with captions", () => {
    const parsed = cutsceneSceneSchema.parse({
      ...validCutscene,
      captions: "videos/intro.vtt",
    });
    expect(parsed.captions).toBe("videos/intro.vtt");
  });

  it('accepts the "after-ms" skip policy with a positive afterMs', () => {
    const parsed = cutsceneSceneSchema.parse({
      ...validCutscene,
      skipPolicy: { kind: "after-ms", afterMs: 3000 },
    });
    expect(parsed.skipPolicy).toEqual({ kind: "after-ms", afterMs: 3000 });
  });

  it('rejects "after-ms" with a non-positive afterMs', () => {
    const parsed = cutsceneSceneSchema.safeParse({
      ...validCutscene,
      skipPolicy: { kind: "after-ms", afterMs: 0 },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown skipPolicy kind", () => {
    const parsed = cutsceneSceneSchema.safeParse({
      ...validCutscene,
      skipPolicy: { kind: "never" },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a cutscene missing the video field", () => {
    const noVideo = { ...validCutscene, video: undefined };
    const parsed = cutsceneSceneSchema.safeParse(noVideo);
    expect(parsed.success).toBe(false);
  });

  it("rejects a cutscene video path with a leading slash", () => {
    const parsed = cutsceneSceneSchema.safeParse({
      ...validCutscene,
      video: "/leak.mp4",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a captions path with a leading slash", () => {
    const parsed = cutsceneSceneSchema.safeParse({
      ...validCutscene,
      captions: "/leak.vtt",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("migrate", () => {
  const legacyV1Game = {
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
        onAdvance: { gotoSceneId: null },
      },
    ],
  };

  it("passes through a current-version game", () => {
    const parsed = migrate(validGame);
    expect(parsed.id).toBe("hello");
    expect(parsed.version).toBe(SCHEMA_VERSION);
  });

  it("migrates a v1 game to the current version", () => {
    const migrated = migrate(legacyV1Game);
    expect(migrated.version).toBe(SCHEMA_VERSION);
    expect(migrated.scenes[0]?.kind).toBe("splash");
  });

  it("preserves scene content across v1 → v2 migration", () => {
    const migrated = migrate(legacyV1Game);
    expect(migrated.scenes).toHaveLength(1);
    expect(migrated.scenes[0]?.id).toBe("title");
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
