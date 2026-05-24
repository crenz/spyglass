import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
  version: 4,
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
        {
          id: "t_key",
          kind: "target",
          shape: "rect",
          rect: { x: 100, y: 100, w: 40, h: 40 },
        },
        {
          id: "r_key",
          kind: "reference",
          shape: "rect",
          rect: { x: 50, y: 600, w: 80, h: 80 },
        },
        {
          id: "t_book",
          kind: "target",
          shape: "rect",
          rect: { x: 300, y: 200, w: 60, h: 60 },
        },
        {
          id: "r_book",
          kind: "reference",
          shape: "rect",
          rect: { x: 150, y: 600, w: 80, h: 80 },
        },
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
    const game = { ...validGame, version: 5 };
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
    expect(SCHEMA_VERSION).toBe(4);
  });

  it("validates the bundled hello fixture", () => {
    const path = resolve(process.cwd(), "public/games/hello/manifest.json");
    const raw = JSON.parse(readFileSync(path, "utf8"));
    const game = gameSchema.parse(raw);
    expect(game.id).toBe("hello");
    const hog = game.scenes.find((s) => s.kind === "hidden_object");
    if (hog?.kind !== "hidden_object") throw new Error("no HOG scene");
    const shapes = new Set(hog.regions.map((r) => r.shape));
    expect(shapes.has("rect")).toBe(true);
    expect(shapes.has("polygon")).toBe(true);
    expect(shapes.has("circle")).toBe(true);
    expect(hog.regions.some((r) => r.kind === "hint")).toBe(true);
  });
});

describe("hiddenObjectSceneSchema", () => {
  const validHog = {
    id: "scene_1",
    kind: "hidden_object",
    image: { src: "images/scene-1.png", width: 1024, height: 768 },
    regions: [
      {
        id: "t1",
        kind: "target",
        shape: "rect",
        rect: { x: 10, y: 20, w: 30, h: 40 },
      },
      {
        id: "r1",
        kind: "reference",
        shape: "rect",
        rect: { x: 50, y: 60, w: 70, h: 80 },
      },
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
        {
          id: "x",
          kind: "target",
          shape: "rect",
          rect: { x: 0, y: 0, w: 10, h: 10 },
        },
        {
          id: "x",
          kind: "reference",
          shape: "rect",
          rect: { x: 20, y: 0, w: 10, h: 10 },
        },
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
        {
          id: "t",
          kind: "target",
          shape: "rect",
          rect: { x: 0, y: 0, w: 10, h: 10 },
        },
        {
          id: "r",
          kind: "reference",
          shape: "rect",
          rect: { x: 20, y: 0, w: 10, h: 10 },
        },
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
        {
          id: "t1",
          kind: "target",
          shape: "rect",
          rect: { x: 0, y: 0, w: 0, h: 10 },
        },
        {
          id: "r1",
          kind: "reference",
          shape: "rect",
          rect: { x: 0, y: 0, w: 10, h: 10 },
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a rect with negative coordinates", () => {
    const parsed = hiddenObjectSceneSchema.safeParse({
      ...validHog,
      regions: [
        {
          id: "t1",
          kind: "target",
          shape: "rect",
          rect: { x: -1, y: 0, w: 10, h: 10 },
        },
        {
          id: "r1",
          kind: "reference",
          shape: "rect",
          rect: { x: 0, y: 0, w: 10, h: 10 },
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a polygon region with at least three points", () => {
    const parsed = hiddenObjectSceneSchema.safeParse({
      ...validHog,
      regions: [
        {
          id: "t1",
          kind: "target",
          shape: "polygon",
          polygon: {
            points: [
              [0, 0],
              [10, 0],
              [10, 10],
            ],
          },
        },
        {
          id: "r1",
          kind: "reference",
          shape: "rect",
          rect: { x: 50, y: 0, w: 10, h: 10 },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a polygon with fewer than three points", () => {
    const parsed = hiddenObjectSceneSchema.safeParse({
      ...validHog,
      regions: [
        {
          id: "t1",
          kind: "target",
          shape: "polygon",
          polygon: {
            points: [
              [0, 0],
              [10, 0],
            ],
          },
        },
        {
          id: "r1",
          kind: "reference",
          shape: "rect",
          rect: { x: 50, y: 0, w: 10, h: 10 },
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a circle region with positive radius", () => {
    const parsed = hiddenObjectSceneSchema.safeParse({
      ...validHog,
      regions: [
        {
          id: "t1",
          kind: "target",
          shape: "circle",
          circle: { cx: 50, cy: 50, r: 25 },
        },
        {
          id: "r1",
          kind: "reference",
          shape: "rect",
          rect: { x: 100, y: 100, w: 10, h: 10 },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a circle with non-positive radius", () => {
    const parsed = hiddenObjectSceneSchema.safeParse({
      ...validHog,
      regions: [
        {
          id: "t1",
          kind: "target",
          shape: "circle",
          circle: { cx: 50, cy: 50, r: 0 },
        },
        {
          id: "r1",
          kind: "reference",
          shape: "rect",
          rect: { x: 100, y: 100, w: 10, h: 10 },
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts hint/menu/pause control regions", () => {
    const parsed = hiddenObjectSceneSchema.safeParse({
      ...validHog,
      regions: [
        ...validHog.regions,
        {
          id: "hint_btn",
          kind: "hint",
          shape: "rect",
          rect: { x: 900, y: 700, w: 60, h: 60 },
        },
        {
          id: "menu_btn",
          kind: "menu",
          shape: "rect",
          rect: { x: 960, y: 700, w: 60, h: 60 },
        },
        {
          id: "pause_btn",
          kind: "pause",
          shape: "rect",
          rect: { x: 840, y: 700, w: 60, h: 60 },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown region kind", () => {
    const parsed = hiddenObjectSceneSchema.safeParse({
      ...validHog,
      regions: [
        {
          id: "weird",
          kind: "decoration",
          shape: "rect",
          rect: { x: 0, y: 0, w: 10, h: 10 },
        },
        ...validHog.regions,
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an objective whose targetRegionId points to a non-target kind", () => {
    const parsed = hiddenObjectSceneSchema.safeParse({
      ...validHog,
      regions: [
        {
          id: "t1",
          kind: "reference",
          shape: "rect",
          rect: { x: 10, y: 20, w: 30, h: 40 },
        },
        {
          id: "r1",
          kind: "reference",
          shape: "rect",
          rect: { x: 50, y: 60, w: 70, h: 80 },
        },
      ],
      objectives: [
        {
          id: "obj1",
          label: "Find me",
          targetRegionId: "t1",
          referenceRegionId: "r1",
        },
      ],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((i) =>
          i.message.toLowerCase().includes("target"),
        ),
      ).toBe(true);
    }
  });

  it("rejects an objective whose referenceRegionId points to a non-reference kind", () => {
    const parsed = hiddenObjectSceneSchema.safeParse({
      ...validHog,
      regions: [
        {
          id: "t1",
          kind: "target",
          shape: "rect",
          rect: { x: 10, y: 20, w: 30, h: 40 },
        },
        {
          id: "r1",
          kind: "target",
          shape: "rect",
          rect: { x: 50, y: 60, w: 70, h: 80 },
        },
      ],
      objectives: [
        {
          id: "obj1",
          label: "Find me",
          targetRegionId: "t1",
          referenceRegionId: "r1",
        },
      ],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((i) =>
          i.message.toLowerCase().includes("reference"),
        ),
      ).toBe(true);
    }
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

  const legacyV3Game = {
    id: "hello",
    version: 3,
    title: "Hello",
    startScene: "scene_1",
    scenes: [
      {
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

  it("migrates a v3 game and infers region kinds from objectives", () => {
    const migrated = migrate(legacyV3Game);
    expect(migrated.version).toBe(SCHEMA_VERSION);
    const hog = migrated.scenes[0];
    if (hog?.kind !== "hidden_object") {
      throw new Error("expected hidden_object scene");
    }
    const t1 = hog.regions.find((r) => r.id === "t1");
    const r1 = hog.regions.find((r) => r.id === "r1");
    expect(t1?.kind).toBe("target");
    expect(r1?.kind).toBe("reference");
  });

  it("preserves scene content across v1 → current migration", () => {
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
