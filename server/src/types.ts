import { z } from "zod";

// Reusable positive integer (excluding 0)
export const posInt = z.number().int().gt(0);

// ISO date string (YYYY-MM-DD). We keep dates as day-level for M2.
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

// -------------------- ACTIVITIES --------------------
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

// -------------------- PROGRAMS --------------------
// (Replace your previous programSchema placeholder with this pair)
export const programCreateSchema = z.object({
  name: z.string().min(1),
  id: posInt.optional(),             // server assigns if omitted
});
export const programSchema = programCreateSchema.extend({
  id: posInt,
});
export type ProgramCreate = z.infer<typeof programCreateSchema>;
export type Program = z.infer<typeof programSchema>;

// -------------------- PROJECTS --------------------
// (Replace your previous projectSchema placeholder with this pair)
export const projectCreateSchema = z.object({
  programId: posInt,
  name: z.string().min(1),
  id: posInt.optional(),             // server assigns if omitted
});
export const projectSchema = projectCreateSchema.extend({
  id: posInt,
});
export type ProjectCreate = z.infer<typeof projectCreateSchema>;
export type Project = z.infer<typeof projectSchema>;

// -------------------- STAFF --------------------
export const staffSchema = z.object({ id: posInt, name: z.string().min(1) });
export type Staff = z.infer<typeof staffSchema>;

// -------------------- LEGS (future) --------------------
export const legCreateSchema = z.object({
  projectId: posInt,
  name: z.string().min(1),
  description: z.string().default("")
});
export const legSchema = legCreateSchema.extend({ id: posInt, uid: z.string().uuid() });
export type LegCreate = z.infer<typeof legCreateSchema>;
export type Leg = z.infer<typeof legSchema>;


// -------------------- ASSIGNMENTS --------------------
// For Level 3: rows per staff; assignments linked to project + staff
export const assignmentCreateSchema = z.object({
  staffId: posInt,
  projectId: posInt,
  start: isoDate,
  end: isoDate,
  notes: z.string().default("").optional(),
  id: posInt.optional(), // server assigns if omitted
});

export const assignmentSchema = assignmentCreateSchema.extend({
  id: posInt,
});

export type AssignmentCreate = z.infer<typeof assignmentCreateSchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
