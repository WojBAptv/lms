import { Router } from "express";
import path from "path";
import { v4 as uuid } from "uuid";
import { ensureDataFile, readJson, writeJson } from "../lib/fileDb";
import {
  Activity,
  ActivityCreate,
  activityCreateSchema,
  activitySchema,
  posInt
} from "../types";

const router = Router();
const DATA_FILE = path.resolve(process.cwd(), "data", "activities.json");
(async () => {
  await ensureDataFile(DATA_FILE, [] as Activity[]);
})();

async function getAll(): Promise<Activity[]> {
  const items = await readJson<Activity[]>(DATA_FILE);
  // Always sort by projectId, then by id (order inside project)
  return items.sort((a, b) => (a.projectId - b.projectId) || (a.id - b.id));
}

async function saveAll(items: Activity[]) {
  await writeJson<Activity[]>(DATA_FILE, items);
}

// Compute the next available "id" (order) within a project
function nextOrderForProject(items: Activity[], projectId: number): number {
  const max = items
    .filter(a => a.projectId === projectId)
    .reduce((m, a) => Math.max(m, a.id), 0);
  return max + 1;
}

// GET /api/activities
router.get("/", async (_req, res) => {
  const items = await getAll();
  res.json(items);
});

// GET /api/activities/:uid (fetch by uid)
router.get("/:uid", async (req, res) => {
  const items = await getAll();
  const found = items.find(a => a.uid === req.params.uid);
  if (!found) return res.status(404).json({ error: "Not found" });
  res.json(found);
});

// POST /api/activities
router.post("/", async (req, res) => {
  const parsed = activityCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const payload = parsed.data as ActivityCreate;

  const items = await getAll();

  // Determine id (order) within the project:
  // - if client provided id, ensure it's positive and not already taken for that project
  // - otherwise assign next available
  let id: number;
  if (payload.id !== undefined) {
    const idCheck = posInt.safeParse(payload.id);
    if (!idCheck.success) return res.status(400).json({ error: "Invalid id (must be positive int > 0)" });
    const clash = items.some(a => a.projectId === payload.projectId && a.id === payload.id);
    if (clash) return res.status(409).json({ error: "id already used in this project" });
    id = payload.id;
  } else {
    id = nextOrderForProject(items, payload.projectId);
  }

  const newItem: Activity = {
    uid: uuid(),
    id,
    projectId: payload.projectId,
    description: payload.description,
    type: payload.type,
    resource: payload.resource ?? "",
    sequence: payload.sequence ?? "",
    legId: payload.legId
  };

  items.push(newItem);
  await saveAll(items);
  res.status(201).json(newItem);
});

// PUT /api/activities/:uid  (update by uid; id/order may change)
router.put("/:uid", async (req, res) => {
  const uid = req.params.uid;
  const items = await getAll();
  const idx = items.findIndex(a => a.uid === uid);
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  // Merge and validate with full schema, but preserve uid
  const merged = { ...items[idx], ...req.body, uid } as Activity;

  // If id (order) is changing, ensure no duplicates within the project
  if (req.body?.id !== undefined) {
    const idCheck = posInt.safeParse(req.body.id);
    if (!idCheck.success) return res.status(400).json({ error: "Invalid id (must be positive int > 0)" });
    const duplicate = items.some(a =>
      a.projectId === merged.projectId && a.id === merged.id && a.uid !== uid
    );
    if (duplicate) return res.status(409).json({ error: "id already used in this project" });
  }

  const check = activitySchema.safeParse(merged);
  if (!check.success) return res.status(400).json({ error: check.error.flatten() });

  items[idx] = check.data;
  await saveAll(items);
  res.json(items[idx]);
});

// DELETE /api/activities/:uid
router.delete("/:uid", async (req, res) => {
  const uid = req.params.uid;
  const items = await getAll();
  const next = items.filter(a => a.uid !== uid);
  if (next.length === items.length) return res.status(404).json({ error: "Not found" });
  await saveAll(next);
  res.status(204).send();
});

export default router;
