import { describe, it, expect } from "vitest";
import {
  gameSchema,
  splashSceneSchema,
  cutsceneSceneSchema,
  hiddenObjectSceneSchema,
  SCHEMA_VERSION,
} from "@/schema/game";
import { migrate, SchemaMigrationError } from "@/schema/migrate";

const validGame = {
  id: "hello",
  version: 3,
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
      onEnd: { gotoSceneId: "scene_1" },
    },
    {
      id: "scene_1",
      kind: "hidden_object",
      title: "The library",
      image: { src: "images/scene-1.png", width: 1024, height: 768 },
      regions: [
        { id: "t_key", shape: "rect", rect: { x: 100, y: 100, w: 40, h: 40 } },
        { id: "r_key", shape: "rect", rect: { x: 50, y: 600, w: 80, h: 80 } },
        { id: "t_book", shape: "rect", rect: { x: 300, y: 200, w: 60, h: 60 } },
        { id: "r_book", shape: "rect", rect: { x: 150, y: 600, w: 80, h: 80 } },
      ],
      objectives: [
        {
          id: "key",
          label: "Brass key",
          targetRegionId: "t_key",
          referenceRegionId: "r_key",
        },
        {
          id: "book",
          label: "Leather book",
          targetRegionId: "t_book",
          referenceRegionId: "r_book",
        },
      ],
      onComplete: { gotoSceneId: "intro" },
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
  it("round-trips a valid splash + cutscene + HOG game", () => {
    const parsed = gameSchema.parse(validGame);
    expect(parsed.id).toBe("hello");
    expect(parsed.scenes).toHaveLength(4);
    expect(parsed.scenes[1]?.kind).toBe("cutscene");
    expect(parsed.scenes[2]?.kind).toBe("hidden_object");
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
    const game = { ...validGame, version: 4 };
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
    expect(SCHEMA_VERSION).toBe(3);
  });
});

describe("hiddenObjectSceneSchema", () => {
  const validHog = {
    id: "scene_1",
    kind: "hidden_object",
    image: { src: "images/scene-1.png", width: 1024, height: 768 },
    regions: [
      { id: "t1", shape: "rect", rect: { x: 10, y: 20, w: 30, h: 40 } },
      { id: "r1", shape: "rect", rect: { x: 50, y: 60, w: 70, h: 80 } },
    ],
    objectives: [
      {
        id: "obj1",
        label: "Find me",
        targetRegionId: "t1",
        referenceRegionId: "r1",
      },
    ],
    onComplete: { gotoSceneId: null },
  };

  it("accepts a minimal valid HOG scene", () => {
    const parsed = hiddenObjectSceneSchema.parse(validHog);
    expect(parsed.regions).toHaveLength(2);
    expect(parsed.objectives).toHaveLength(1);
  });

  it("rejects an HOG scene with zero objectives", () => {
    const parsed = hiddenObjectSceneSchema.safeParse({
      ...validHog,
      objectives: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an HOG scene with zero regions", () => {
    const parsed = hiddenObjectSceneSchema.safeParse({
      ...validHog,
      regions: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects duplicate region IDs", () => {
    const parsed = hiddenObjectSceneSchema.safeParse({
      ...validHog,
      regions: [
        { id: "x", shape: "rect", rect: { x: 0, y: 0, w: 10, h: 10 } },
        { id: "x", shape: "rect", rect: { x: 20, y: 0, w: 10, h: 10 } },
      ],
      objectives: [
        {
          id: "o",
          label: "L",
          targetRegionId: "x",
          referenceRegionId: "x",
        },
      ],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((i) =>
          i.message.toLowerCase().includes("duplicate"),
        ),
      ).toBe(true);
    }
  });

  it("rejects duplicate objective IDs", () => {
    const parsed = hiddenObjectSceneSchema.safeParse({
      ...validHog,
      regions: [
        { id: "t", shape: "rect", rect: { x: 0, y: 0, w: 10, h: 10 } },
        { id: "r", shape: "rect", rect: { x: 20, y: 0, w: 10, h: 10 } },
      ],
      objectives: [
        { id: "o", label: "A", targetRegionId: "t", referenceRegionId: "r" },
        { id: "o", label: "B", targetRegionId: "t", referenceRegionId: "r" },
      ],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((i) =>
          i.message.toLowerCase().includes("duplicate"),
        ),
      ).toBe(true);
    }
  });

  it("rejects an objective referencing an unknown target region", () => {
    const parsed = hiddenObjectSceneSchema.safeParse({
      ...validHog,
      objectives: [
        {
          id: "obj1",
          label: "L",
          targetRegionId: "ghost",
          referenceRegionId: "r1",
        },
      ],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message.includes("ghost"))).toBe(
        true,
      );
    }
  });

  it("rejects an objective referencing an unknown reference region", () => {
    const parsed = hiddenObjectSceneSchema.safeParse({
      ...validHog,
      objectives: [
        {
          id: "obj1",
          label: "L",
          targetRegionId: "t1",
          referenceRegionId: "ghost",
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an image path with a leading slash", () => {
    const parsed = hiddenObjectSceneSchema.safeParse({
      ...validHog,
      image: { src: "/leak.png", width: 100, height: 100 },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects non-positive image dimensions", () => {
    const a = hiddenObjectSceneSchema.safeParse({
      ...validHog,
      image: { src: "images/x.png", width: 0, height: 100 },
    });
    const b = hiddenObjectSceneSchema.safeParse({
      ...validHog,
      image: { src: "images/x.png", width: 100, height: 0 },
    });
    expect(a.success).toBe(false);
    expect(b.success).toBe(false);
  });

  it("rejects a rect with non-positive width or height", () => {
    const parsed = hiddenObjectSceneSchema.safeParse({
      ...validHog,
      regions: [
        { id: "t1", shape: "rect", rect: { x: 0, y: 0, w: 0, h: 10 } },
        { id: "r1", shape: "rect", rect: { x: 0, y: 0, w: 10, h: 10 } },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a rect with negative coordinates", () => {
    const parsed = hiddenObjectSceneSchema.safeParse({
      ...validHog,
      regions: [
        { id: "t1", shape: "rect", rect: { x: -1, y: 0, w: 10, h: 10 } },
        { id: "r1", shape: "rect", rect: { x: 0, y: 0, w: 10, h: 10 } },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an HOG onComplete pointing to an unknown scene at game level", () => {
    const game = structuredClone(validGame);
    const hog = game.scenes[2] as {
      onComplete: { gotoSceneId: string | null };
    };
    hog.onComplete.gotoSceneId = "ghost";
    const err = gameSchema.safeParse(game);
    expect(err.success).toBe(false);
    if (!err.success) {
      expect(
        err.error.issues.some((i) => i.message.includes("unknown scene")),
      ).toBe(true);
    }
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

  const legacyV2Game = {
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

  it("migrates a v2 game to the current version", () => {
    const migrated = migrate(legacyV2Game);
    expect(migrated.version).toBe(SCHEMA_VERSION);
    expect(migrated.scenes[0]?.kind).toBe("splash");
  });

  it("preserves scene content across v1 → v3 migration", () => {
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
