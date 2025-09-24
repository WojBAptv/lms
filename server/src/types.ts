import { z } from "zod";

// Reusable positive integer (excluding 0)
export const posInt = z.number().int().gt(0);

// ISO date string (YYYY-MM-DD). We keep dates as day-level for M2.
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

// ACTIVITY (create payload)
export const activityCreateSchema = z.object({
  projectId: posInt,                 // project ID as positive int
  description: z.string().min(1),    // required text
  type: z.string().min(1),           // e.g. "test", "assembly"
  resource: z.string().default(""),  // optional
  sequence: z.string().default(""),  // optional
  // Optional: allow client to suggest an id (order) and/or legId, but validate
  id: posInt.optional(),             // if omitted, server assigns next available within project
  legId: posInt.optional(),          // future feature
  start: isoDate.optional(),         // schedule start (YYYY-MM-DD)
  end: isoDate.optional()            // schedule end (YYYY-MM-DD, inclusive)
});

export const activitySchema = activityCreateSchema.extend({
  id: posInt,                        // order/index within the project (>=1)
  uid: z.string().uuid(),            // server unique id
  start: isoDate,                    // required once created
  end: isoDate
});

export type ActivityCreate = z.infer<typeof activityCreateSchema>;
export type Activity = z.infer<typeof activitySchema>;

// ---- minimal placeholders for later milestones ----
export const programSchema = z.object({ id: posInt, name: z.string().min(1) });
export type Program = z.infer<typeof programSchema>;

export const projectSchema = z.object({ id: posInt, programId: posInt, name: z.string().min(1) });
export type Project = z.infer<typeof projectSchema>;

export const staffSchema = z.object({ id: posInt, name: z.string().min(1) });
export type Staff = z.infer<typeof staffSchema>;

// Legs (future)
export const legCreateSchema = z.object({
  projectId: posInt,
  name: z.string().min(1),
  description: z.string().default("")
});
export const legSchema = legCreateSchema.extend({ id: posInt, uid: z.string().uuid() });
export type LegCreate = z.infer<typeof legCreateSchema>;
export type Leg = z.infer<typeof legSchema>;
