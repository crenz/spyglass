import { z } from "zod";

export const SCHEMA_VERSION = 3;

const sceneIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9_-]+$/, {
    message:
      "Scene IDs use lowercase letters, digits, hyphen, and underscore only.",
  });

const assetPathSchema = z
  .string()
  .min(1)
  .refine(
    (p) => !p.startsWith("/") && !p.includes("://") && !p.includes(".."),
    {
      message:
        'Asset paths are bundle-relative (e.g. "images/title.png"). No leading slash, no scheme, no "..".',
    },
  );

const splashAdvanceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("click") }),
  z.object({ kind: z.literal("key") }),
  z.object({
    kind: z.literal("timeout"),
    timeoutMs: z.number().int().positive().max(600_000),
  }),
]);

export const splashSceneSchema = z.object({
  id: sceneIdSchema,
  kind: z.literal("splash"),
  title: z.string().min(1).optional(),
  image: assetPathSchema,
  advance: splashAdvanceSchema,
  onAdvance: z.object({
    gotoSceneId: sceneIdSchema.nullable(),
  }),
});

const cutsceneSkipPolicySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("always") }),
  z.object({
    kind: z.literal("after-ms"),
    afterMs: z.number().int().positive().max(600_000),
  }),
]);

export const cutsceneSceneSchema = z.object({
  id: sceneIdSchema,
  kind: z.literal("cutscene"),
  title: z.string().min(1).optional(),
  video: assetPathSchema,
  captions: assetPathSchema.optional(),
  skipPolicy: cutsceneSkipPolicySchema,
  onEnd: z.object({
    gotoSceneId: sceneIdSchema.nullable(),
  }),
});

const regionIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9_-]+$/, {
    message:
      "Region IDs use lowercase letters, digits, hyphen, and underscore only.",
  });

const objectiveIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9_-]+$/, {
    message:
      "Objective IDs use lowercase letters, digits, hyphen, and underscore only.",
  });

const rectSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

export const regionSchema = z.object({
  id: regionIdSchema,
  shape: z.literal("rect"),
  rect: rectSchema,
});

export const objectiveSchema = z.object({
  id: objectiveIdSchema,
  label: z.string().min(1),
  targetRegionId: regionIdSchema,
  referenceRegionId: regionIdSchema,
});

const hiddenObjectImageSchema = z.object({
  src: assetPathSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const hiddenObjectSceneBaseSchema = z.object({
  id: sceneIdSchema,
  kind: z.literal("hidden_object"),
  title: z.string().min(1).optional(),
  image: hiddenObjectImageSchema,
  regions: z.array(regionSchema).min(1),
  objectives: z.array(objectiveSchema).min(1),
  onComplete: z.object({
    gotoSceneId: sceneIdSchema.nullable(),
  }),
});

function refineHiddenObjectScene(
  scene: z.infer<typeof hiddenObjectSceneBaseSchema>,
  ctx: z.RefinementCtx,
  pathPrefix: (string | number)[] = [],
): void {
  const regionIds = new Set<string>();
  for (const region of scene.regions) {
    if (regionIds.has(region.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate region ID: "${region.id}".`,
        path: [...pathPrefix, "regions"],
      });
    }
    regionIds.add(region.id);
  }
  const objectiveIds = new Set<string>();
  for (const objective of scene.objectives) {
    if (objectiveIds.has(objective.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate objective ID: "${objective.id}".`,
        path: [...pathPrefix, "objectives"],
      });
    }
    objectiveIds.add(objective.id);
    if (!regionIds.has(objective.targetRegionId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Objective "${objective.id}" references unknown target region "${objective.targetRegionId}".`,
        path: [...pathPrefix, "objectives"],
      });
    }
    if (!regionIds.has(objective.referenceRegionId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Objective "${objective.id}" references unknown reference region "${objective.referenceRegionId}".`,
        path: [...pathPrefix, "objectives"],
      });
    }
  }
}

export const hiddenObjectSceneSchema = hiddenObjectSceneBaseSchema.superRefine(
  (scene, ctx) => refineHiddenObjectScene(scene, ctx),
);

export const sceneSchema = z.discriminatedUnion("kind", [
  splashSceneSchema,
  cutsceneSceneSchema,
  hiddenObjectSceneBaseSchema,
]);

function sceneTransitionTargets(scene: z.infer<typeof sceneSchema>): {
  path: (string | number)[];
  target: string | null;
}[] {
  switch (scene.kind) {
    case "splash":
      return [
        {
          path: ["onAdvance", "gotoSceneId"],
          target: scene.onAdvance.gotoSceneId,
        },
      ];
    case "cutscene":
      return [
        { path: ["onEnd", "gotoSceneId"], target: scene.onEnd.gotoSceneId },
      ];
    case "hidden_object":
      return [
        {
          path: ["onComplete", "gotoSceneId"],
          target: scene.onComplete.gotoSceneId,
        },
      ];
  }
}

export const gameSchema = z
  .object({
    id: z.string().min(1),
    version: z.literal(SCHEMA_VERSION),
    title: z.string().min(1),
    startScene: sceneIdSchema,
    scenes: z.array(sceneSchema).min(1),
  })
  .superRefine((game, ctx) => {
    const ids = new Set<string>();
    for (const scene of game.scenes) {
      if (ids.has(scene.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate scene ID: "${scene.id}".`,
          path: ["scenes"],
        });
      }
      ids.add(scene.id);
    }
    if (!ids.has(game.startScene)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `startScene "${game.startScene}" does not match any scene ID.`,
        path: ["startScene"],
      });
    }
    for (let i = 0; i < game.scenes.length; i++) {
      const scene = game.scenes[i]!;
      for (const { target } of sceneTransitionTargets(scene)) {
        if (target !== null && !ids.has(target)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Scene "${scene.id}" advances to unknown scene "${target}".`,
            path: ["scenes"],
          });
        }
      }
      if (scene.kind === "hidden_object") {
        refineHiddenObjectScene(scene, ctx, ["scenes", i]);
      }
    }
  });

export type SplashAdvance = z.infer<typeof splashAdvanceSchema>;
export type SplashScene = z.infer<typeof splashSceneSchema>;
export type CutsceneSkipPolicy = z.infer<typeof cutsceneSkipPolicySchema>;
export type CutsceneScene = z.infer<typeof cutsceneSceneSchema>;
export type Rect = z.infer<typeof rectSchema>;
export type Region = z.infer<typeof regionSchema>;
export type Objective = z.infer<typeof objectiveSchema>;
export type HiddenObjectScene = z.infer<typeof hiddenObjectSceneSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Game = z.infer<typeof gameSchema>;
