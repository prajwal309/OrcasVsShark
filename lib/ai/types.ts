import { z } from "zod";

export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof difficultySchema>;
export const computerSettingsSchema = z
  .object({
    humanSide: z.enum(["orcas", "sharks"]),
    difficulty: difficultySchema,
  })
  .strict();
export type ComputerSettings = z.infer<typeof computerSettingsSchema>;

export const SEARCH_LIMITS = {
  easy: { timeMs: 120, maxDepth: 2, variety: 60 },
  medium: { timeMs: 450, maxDepth: 5, variety: 0 },
  hard: { timeMs: 1400, maxDepth: 8, variety: 0 },
} as const;

export const workerRequestSchema = z
  .object({
    snapshot: z.string().max(1_500_000),
    difficulty: difficultySchema,
  })
  .strict();
export const workerResponseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("move"), move: z.unknown() }).strict(),
  z.object({ kind: z.literal("error") }).strict(),
]);
