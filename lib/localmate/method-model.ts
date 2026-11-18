import { z } from "zod";

export const methodFields = z.object({
  name: z.string().trim().min(1).max(80),
  scope: z.string().trim().min(1).max(240),
  instructions: z.string().trim().min(1).max(2400),
}).strict();

export const methodUpdate = z.object({
  revision: z.number().int().nonnegative(),
  fields: methodFields.optional(),
  enabled: z.boolean().optional(),
}).strict().refine(input => input.fields !== undefined || input.enabled !== undefined);

export type MethodFields = z.infer<typeof methodFields>;
export type MethodUpdate = z.infer<typeof methodUpdate>;
export type MethodSnapshot = MethodFields & { id: string; revision: number };
export type Method = MethodSnapshot & { enabled: boolean };
