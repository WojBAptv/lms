import { z } from "zod";

// Reusable positive integer (excluding 0)
export const posInt = z.number().int().gt(0);

// ACTIVITY (create payload)
export const activityCreateSchema = z.object({
  projectId: posInt,                 // project ID as positive int
  description: z.string().min(1),    // required text
  type: z.string().min(1),           // e.g. "test", "assembly"
  resource: z.string().default(""),  // optional
  sequence: z.string().default(""),  // can be empty string
  // Optional: allow client to suggest an id (order) and/or legId, but validate
  id: posInt.optional(),             // if omitted, server will assign next available within project
  legId: posInt.optional()           // for future legs feature (can be omitted now)
});

// ACTIVITY (stored shape)
export const activitySchema = activityCreateSchema.extend({
  id: posInt,                        // required once stored (order within project)
  uid: z.string().uuid()             // globally unique stable identifier
});

export type ActivityCreate = z.infer<typeof activityCreateSchema>;
export type Activity = z.infer<typeof activitySchema>;

// LEG (optional – for future grouping)
// Legs group activities inside a project and can carry a name/description.
export const legCreateSchema = z.object({
  projectId: posInt,
  name: z.string().min(1),
  description: z.string().default("")
});

export const legSchema = legCreateSchema.extend({
  id: posInt,                        // order/index within the project for legs themselves
  uid: z.string().uuid()
});

export type LegCreate = z.infer<typeof legCreateSchema>;
export type Leg = z.infer<typeof legSchema>;
