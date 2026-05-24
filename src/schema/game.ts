import { z } from "zod";

export const SCHEMA_VERSION = 1;

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

export const sceneSchema = z.discriminatedUnion("kind", [splashSceneSchema]);

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
    for (const scene of game.scenes) {
      const target = scene.onAdvance.gotoSceneId;
      if (target !== null && !ids.has(target)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Scene "${scene.id}" advances to unknown scene "${target}".`,
          path: ["scenes"],
        });
      }
    }
  });

export type SplashAdvance = z.infer<typeof splashAdvanceSchema>;
export type SplashScene = z.infer<typeof splashSceneSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Game = z.infer<typeof gameSchema>;
